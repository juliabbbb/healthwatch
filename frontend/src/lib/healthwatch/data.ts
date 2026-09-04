/**
 * HEALTHWATCH data layer.
 *
 * Sources real DOH Epidemiology Bureau dengue surveillance (2016-2019 +
 * 2022-2025, via the UPRI-NOAH open dataset) served by the FastAPI backend
 * (src/api.py) over SQLite. Series and validation metrics are fetched once
 * at startup via `loadHealthwatchData()`; every component then reads the
 * caches synchronously, keeping render output stable across renders/SSR.
 */

export type RiskLevel = "low" | "moderate" | "high";
export type Season = "wet" | "dry";

export interface Region {
  code: string; // PSGC region code
  name: string;
  short: string;
  island: "Luzon" | "Visayas" | "Mindanao";
  geoName: string; // matches properties.REGION in the PSGC GeoJSON
  lat: number;
  lng: number;
  classification: "Highly urban" | "Urban" | "Rural-urban mix" | "Predominantly rural";
  density: number; // persons / km2
  population: number;
}

export const REGIONS: Region[] = [
  {
    code: "130000000",
    name: "National Capital Region",
    short: "NCR",
    island: "Luzon",
    geoName: "Metropolitan Manila",
    lat: 14.5995,
    lng: 120.9842,
    classification: "Highly urban",
    density: 21765,
    population: 13484462,
  },
  {
    code: "140000000",
    name: "Cordillera Administrative Region",
    short: "CAR",
    island: "Luzon",
    geoName: "Cordillera Administrative Region (CAR)",
    lat: 17.35,
    lng: 121.1,
    classification: "Predominantly rural",
    density: 96,
    population: 1797660,
  },
  {
    code: "010000000",
    name: "Ilocos Region",
    short: "Region I",
    island: "Luzon",
    geoName: "Ilocos Region (Region I)",
    lat: 16.6,
    lng: 120.45,
    classification: "Rural-urban mix",
    density: 421,
    population: 5301139,
  },
  {
    code: "020000000",
    name: "Cagayan Valley",
    short: "Region II",
    island: "Luzon",
    geoName: "Cagayan Valley (Region II)",
    lat: 17.0,
    lng: 121.8,
    classification: "Predominantly rural",
    density: 133,
    population: 3685744,
  },
  {
    code: "030000000",
    name: "Central Luzon",
    short: "Region III",
    island: "Luzon",
    geoName: "Central Luzon (Region III)",
    lat: 15.4,
    lng: 120.7,
    classification: "Urban",
    density: 663,
    population: 12422172,
  },
  {
    code: "040000000",
    name: "CALABARZON",
    short: "Region IV-A",
    island: "Luzon",
    geoName: "CALABARZON (Region IV-A)",
    lat: 14.1,
    lng: 121.3,
    classification: "Highly urban",
    density: 1058,
    population: 16195042,
  },
  {
    code: "170000000",
    name: "MIMAROPA",
    short: "Region IV-B",
    island: "Luzon",
    geoName: "MIMAROPA (Region IV-B)",
    lat: 12.3,
    lng: 120.9,
    classification: "Predominantly rural",
    density: 111,
    population: 3228558,
  },
  {
    code: "050000000",
    name: "Bicol Region",
    short: "Region V",
    island: "Luzon",
    geoName: "Bicol Region (Region V)",
    lat: 13.4,
    lng: 123.4,
    classification: "Rural-urban mix",
    density: 359,
    population: 6082165,
  },
  {
    code: "060000000",
    name: "Western Visayas",
    short: "Region VI",
    island: "Visayas",
    geoName: "Western Visayas (Region VI)",
    lat: 11.0,
    lng: 122.6,
    classification: "Rural-urban mix",
    density: 407,
    population: 7954723,
  },
  {
    code: "070000000",
    name: "Central Visayas",
    short: "Region VII",
    island: "Visayas",
    geoName: "Central Visayas (Region VII)",
    lat: 10.0,
    lng: 123.7,
    classification: "Urban",
    density: 561,
    population: 8081988,
  },
  {
    code: "080000000",
    name: "Eastern Visayas",
    short: "Region VIII",
    island: "Visayas",
    geoName: "Eastern Visayas (Region VIII)",
    lat: 11.4,
    lng: 125.0,
    classification: "Predominantly rural",
    density: 214,
    population: 4547150,
  },
  {
    code: "090000000",
    name: "Zamboanga Peninsula",
    short: "Region IX",
    island: "Mindanao",
    geoName: "Zamboanga Peninsula (Region IX)",
    lat: 8.0,
    lng: 122.9,
    classification: "Rural-urban mix",
    density: 235,
    population: 3875576,
  },
  {
    code: "100000000",
    name: "Northern Mindanao",
    short: "Region X",
    island: "Mindanao",
    geoName: "Northern Mindanao (Region X)",
    lat: 8.3,
    lng: 124.7,
    classification: "Rural-urban mix",
    density: 269,
    population: 5022768,
  },
  {
    code: "110000000",
    name: "Davao Region",
    short: "Region XI",
    island: "Mindanao",
    geoName: "Davao Region (Region XI)",
    lat: 7.1,
    lng: 125.6,
    classification: "Urban",
    density: 264,
    population: 5243536,
  },
  {
    code: "120000000",
    name: "SOCCSKSARGEN",
    short: "Region XII",
    island: "Mindanao",
    geoName: "SOCCSKSARGEN (Region XII)",
    lat: 6.5,
    lng: 124.9,
    classification: "Rural-urban mix",
    density: 231,
    population: 4901486,
  },
  {
    code: "160000000",
    name: "Caraga",
    short: "Region XIII",
    island: "Mindanao",
    geoName: "Caraga (Region XIII)",
    lat: 8.9,
    lng: 125.7,
    classification: "Predominantly rural",
    density: 145,
    population: 2804788,
  },
  {
    code: "150000000",
    name: "Bangsamoro (BARMM)",
    short: "BARMM",
    island: "Mindanao",
    geoName: "Autonomous Region of Muslim Mindanao (ARMM)",
    lat: 7.2,
    lng: 124.2,
    classification: "Predominantly rural",
    density: 208,
    population: 4404288,
  },
];

export const REGION_BY_CODE = Object.fromEntries(REGIONS.map((r) => [r.code, r]));
export const REGION_BY_GEONAME = Object.fromEntries(REGIONS.map((r) => [r.geoName, r]));

export interface Illness {
  id: string;
  name: string;
  shortName: string;
  driver: string;
  peakWeek: number; // week-of-year of climatological peak
  season: Season;
  amplitude: number; // seasonal swing strength
  baseRate: number; // cases / 100k / week
  trend: number; // yearly multiplicative drift
}

/**
 * Scope note (capstone): the pipeline currently ingests Dengue only. The
 * Illness shape is kept so additional DOH Epidemiology Bureau disease tables
 * can be added to NATIONAL_FILES in the backend without UI changes.
 */
export const ILLNESSES: Illness[] = [
  {
    id: "dengue",
    name: "Dengue",
    shortName: "Dengue",
    driver: "Aedes vector density after sustained rainfall",
    peakWeek: 34,
    season: "wet",
    amplitude: 1.15,
    baseRate: 1.6,
    trend: 0.045,
  },
];

export const ILLNESS_BY_ID = Object.fromEntries(ILLNESSES.map((i) => [i.id, i]));

export const WEEKS_PER_YEAR = 52;
/**
 * Observed weekly rows per region served by the backend: 2016-01-10 through
 * 2025-12-28 (DOH Epidemiology Bureau via the UPRI-NOAH open dataset).
 */
export const HIST_WEEKS = 416;
export const FORECAST_WEEKS = 12;
export const TOTAL_WEEKS = HIST_WEEKS + FORECAST_WEEKS;

const ANCHOR_SUNDAY = Date.UTC(2016, 0, 10);

export function weekMeta(index: number) {
  const date = new Date(ANCHOR_SUNDAY + index * 7 * 24 * 3600 * 1000);
  const iso = isoWeek(date);
  const year = iso.year;
  const week = iso.week;
  const month = date.getUTCMonth() + 1;
  return {
    year,
    week,
    label: `${year}-W${String(week).padStart(2, "0")}`,
    date: date.toISOString().slice(0, 10),
    month,
    season: (month >= 6 && month <= 11 ? "wet" : "dry") as Season,
    forecast: index >= HIST_WEEKS,
  };
}

function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return {
    year: t.getUTCFullYear(),
    week: Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  };
}

export interface WeekPoint {
  index: number;
  year: number;
  week: number; // 1-52
  label: string; // 2023-W41
  date: string; // ISO date of week start
  season: Season;
  forecast: boolean;
  cases: number; // reported (historical) or predicted
  lower: number;
  upper: number;
  raw: number; // unadjusted model output (may be negative / spiked)
  adjusted: boolean; // true when a post-processing rule changed the value
  adjustReason?: string;
}

export function seasonForWeek(week: number): Season {
  // Fixed calendar definition (wet: Jun–Nov, dry: Dec–May) — date-only, no external feed.
  return week >= 22 && week <= 48 ? "wet" : "dry";
}

/**
 * Strict calendar-boundary season for a month (1-12): Jun-Nov = wet,
 * Dec-May = dry. Season is a fixed calendar definition (not a live
 * PAGASA/weather feed) — this is a deliberate deterministic design choice
 * per Objective 5.
 */
export function seasonForMonth(month: number): Season {
  return month >= 6 && month <= 11 ? "wet" : "dry";
}

/**
 * The season that starts after the given calendar month. Season is a fixed
 * calendar definition (not a live PAGASA/weather feed) — this is a deliberate
 * deterministic design choice per Objective 5.
 */
export function upcomingSeasonForMonth(month: number): Season {
  return seasonForMonth(month) === "wet" ? "dry" : "wet";
}

/** The season that starts after the given ISO week (upcoming probe window). */
export function upcomingSeasonForWeek(week: number): Season {
  return seasonForWeek(week) === "wet" ? "dry" : "wet";
}

/* ------------------------------------------------------------------ */
/* Data loading — live FastAPI server over SQLite                      */
/* ------------------------------------------------------------------ */

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";
const DISEASE = "dengue";

const seriesCache = new Map<string, WeekPoint[]>();
const metricsCache = new Map<string, ModelMetrics>();

async function fetchJson<T>(path: string, attempts = 10): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${API_BASE}${path}`);
      if (!res.ok) throw new Error(`API ${path} failed: HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      // Back off and retry: tolerates the backend still booting when the
      // dev page first loads, and free-tier hosts that sleep between demos
      // (Render cold starts can take ~60s).
      await new Promise((r) => setTimeout(r, 1200 * Math.min(i + 1, 6)));
    }
  }
  throw lastErr;
}

interface ApiMetrics {
  region: string;
  mae: number;
  rmse: number;
  mape: number;
  weeks: number;
  confidence: { label: string; tone: "low" | "moderate" | "high" };
  skill_vs_naive: { pre_covid_52w: number; pre_2025_52w: number } | null;
}

/**
 * Fetches every region's series and validation metrics from the API once.
 * Resolves before the router renders any route (gated in __root.tsx) so all
 * downstream components can keep reading caches synchronously.
 */
export async function loadHealthwatchData(): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const region of REGIONS) {
    jobs.push(
      fetchJson<{ points: WeekPoint[] }>(`/series/${region.short}`).then((res) => {
        seriesCache.set(`${region.code}:${DISEASE}`, res.points);
        seriesCache.set(`${region.code}:__all`, res.points);
      }),
    );
    jobs.push(
      fetchJson<ApiMetrics>(`/metrics/${region.short}`).then((m) => {
        metricsCache.set(region.code, {
          folds: m.weeks,
          label: m.confidence.label,
          tone: m.confidence.tone,
          note: m.confidence.tone === "low"
            ? "Model error is small relative to weekly case counts."
            : m.confidence.tone === "moderate"
              ? "Reasonable accuracy on holdout weeks."
              : "COVID-era volatility inflates error metrics.",
          mae: m.mae,
          rmse: m.rmse,
          mape: m.mape,
        });
      }),
    );
  }
  await Promise.all(jobs);
  try {
    await loadOutbreakData();
  } catch (err) {
    // Outbreak layer is additive; a backend without /outbreak (older deploy or
    // a not-yet-restarted uvicorn) must not take the whole dashboard down.
    console.warn("Seasonal outbreak indicator unavailable:", err);
  }
}

/** Starts loading immediately on module import. */
export const dataReady = loadHealthwatchData();

/** Cached per region+illness so charts and the map share one source of truth. */
export function getSeries(regionCode: string, illnessId: string): WeekPoint[] {
  return seriesCache.get(`${regionCode}:${illnessId}`) ?? [];
}

function getTotalSeries(regionCode: string): WeekPoint[] {
  return getSeries(regionCode, DISEASE);
}

export function seriesFor(regionCode: string, illnessId: string | "all"): WeekPoint[] {
  return illnessId === "all" ? getTotalSeries(regionCode) : getSeries(regionCode, illnessId);
}

/* ------------------------------------------------------------------ */
/* Classification engine                                               */
/* ------------------------------------------------------------------ */

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

export interface Thresholds {
  p50: number;
  p75: number;
}

/** Classification metric: raw weekly case counts or cases per 100k residents. */
export type MetricMode = "raw" | "percapita";

export const METRIC_META: Record<MetricMode, { label: string; short: string; unit: string }> = {
  raw: { label: "Raw case count", short: "Raw cases", unit: "cases/week" },
  percapita: { label: "Cases per 100,000 population", short: "Per 100k", unit: "per 100k/week" },
};

/** Convert a case count into the active metric for a region. */
export function metricValue(cases: number, region: Region, mode: MetricMode): number {
  if (mode === "raw") return cases;
  return Number(((cases / region.population) * 100000).toFixed(2));
}

export function formatMetric(value: number, mode: MetricMode): string {
  return mode === "raw"
    ? Math.round(value).toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

const inSeasonWindow = (w: number, weekOfYear?: number) => {
  if (weekOfYear === undefined) return true;
  const d = Math.abs(w - weekOfYear);
  return Math.min(d, WEEKS_PER_YEAR - d) <= 6;
};

const poolCache = new Map<string, number[]>();

/**
 * Sorted national distribution: every historical week from every region for the
 * selected illness, expressed in the active metric and restricted to a +/-6-week
 * calendar window, so a region is judged against the seasonal norm rather than
 * the annual average. Pooling across regions is what makes the raw vs
 * per-capita toggle meaningful: in raw mode large-population regions dominate
 * the upper percentiles, while per-capita mode surfaces genuinely intense
 * transmission in smaller regions.
 */
export function pooledValues(
  illnessId: string | "all",
  weekOfYear: number | undefined,
  mode: MetricMode,
): number[] {
  const key = `${illnessId}:${weekOfYear ?? "*"}:${mode}`;
  const hit = poolCache.get(key);
  if (hit) return hit;
  const pooled: number[] = [];
  for (const region of REGIONS) {
    for (const p of seriesFor(region.code, illnessId)) {
      if (p.forecast || !inSeasonWindow(p.week, weekOfYear)) continue;
      pooled.push(metricValue(p.cases, region, mode));
    }
  }
  pooled.sort((a, b) => a - b);
  poolCache.set(key, pooled);
  return pooled;
}

export function getThresholds(
  illnessId: string | "all",
  weekOfYear: number | undefined,
  mode: MetricMode,
): Thresholds {
  const pooled = pooledValues(illnessId, weekOfYear, mode);
  return { p50: percentile(pooled, 0.5), p75: percentile(pooled, 0.75) };
}

export function classify(value: number, t: Thresholds): RiskLevel {
  if (value > t.p75) return "high";
  if (value >= t.p50) return "moderate";
  return "low";
}

export interface RegionAssessment {
  region: Region;
  weekIndex: number;
  point: WeekPoint;
  mode: MetricMode;
  /** point.cases expressed in the active metric (raw cases or per 100k). */
  value: number;
  thresholds: Thresholds;
  risk: RiskLevel;
  percentileRank: number; // 0-100 within the national seasonal distribution
  dominantIllness: Illness;
  fourWeek: WeekPoint[];
  changePct: number;
}

export function assessRegion(
  regionCode: string,
  illnessId: string | "all",
  weekIndex: number,
  mode: MetricMode = "percapita",
): RegionAssessment {
  const region = REGION_BY_CODE[regionCode]!;
  const series = seriesFor(regionCode, illnessId);

  if (!series.length) {
    // A region with no series yet (backend incomplete or unreachable) must not
    // take the dashboard down. Report the requested calendar location with a
    // zeroed point so maps and charts render; the tier falls to Low by
    // construction and the rank lands at the bottom of the national pool.
    const idx = Math.min(Math.max(weekIndex, 0), Math.max(0, TOTAL_WEEKS - 1));
    const safeMeta = weekMeta(idx);
    const point: WeekPoint = {
      index: idx,
      year: safeMeta.year,
      week: safeMeta.week,
      label: safeMeta.label,
      date: safeMeta.date,
      season: safeMeta.season,
      forecast: safeMeta.forecast,
      cases: 0,
      lower: 0,
      upper: 0,
      raw: 0,
      adjusted: false,
    };
    const thresholds = getThresholds(illnessId, point.week, mode);
    const dist = pooledValues(illnessId, point.week, mode);
    return {
      region,
      weekIndex: idx,
      point,
      mode,
      value: 0,
      thresholds,
      risk: classify(0, thresholds),
      percentileRank: Math.round(
        (dist.filter((v) => v <= 0).length / Math.max(1, dist.length)) * 100,
      ),
      dominantIllness: ILLNESSES[0]!,
      fourWeek: [],
      changePct: 0,
    };
  }

  const idx = Math.min(Math.max(weekIndex, 0), series.length - 1);
  const point = series[idx]!;
  const thresholds = getThresholds(illnessId, point.week, mode);
  const value = metricValue(point.cases, region, mode);

  const dist = pooledValues(illnessId, point.week, mode);
  const below = dist.filter((v) => v <= value).length;
  const percentileRank = Math.round((below / Math.max(1, dist.length)) * 100);

  const dominantIllness = ILLNESSES.reduce((best, ill) => {
    const ra =
      metricValue(getSeries(regionCode, ill.id)[idx]?.cases ?? 0, region, mode) /
      (getThresholds(ill.id, point.week, mode).p75 || 1);
    const rb =
      metricValue(getSeries(regionCode, best.id)[idx]?.cases ?? 0, region, mode) /
      (getThresholds(best.id, point.week, mode).p75 || 1);
    return ra > rb ? ill : best;
  }, ILLNESSES[0]!);

  const fourWeek = series.slice(idx + 1, idx + 5);
  const prev = series[Math.max(0, idx - 4)]!.cases || 1;
  const changePct = Math.round(((point.cases - prev) / prev) * 100);

  return {
    region,
    weekIndex: idx,
    point,
    mode,
    value,
    thresholds,
    risk: classify(value, thresholds),
    percentileRank,
    dominantIllness,
    fourWeek,
    changePct,
  };
}

export function assessAll(
  illnessId: string | "all",
  weekIndex: number,
  mode: MetricMode = "percapita",
): RegionAssessment[] {
  return REGIONS.map((r) => assessRegion(r.code, illnessId, weekIndex, mode));
}

/* ------------------------------------------------------------------ */
/* Walk-forward validation metrics                                     */
/* ------------------------------------------------------------------ */

export interface ModelMetrics {
  mae: number;
  rmse: number;
  mape: number;
  folds: number;
  label: string; // plain-language confidence
  tone: RiskLevel; // colour tone for the confidence chip
  note: string;
}

/**
 * Walk-forward backtest of the seasonal-naive-with-drift baseline used to
 * generate the published forecast: for each of the last 52 historical weeks we
 * predict using only data available before that week (the same calendar week
 * one year earlier, rescaled by the ratio of the trailing 4-week level to the
 * level around that week last year), then score against the actual value.
 */
export function modelMetrics(regionCode: string, _illnessId: string | "all"): ModelMetrics {
  return (
    metricsCache.get(regionCode) ?? {
      folds: 0,
      label: "No data",
      tone: "moderate",
      note: "—",
      mae: 0,
      rmse: 0,
      mape: 0,
    }
  );
}

/* ------------------------------------------------------------------ */
/* STL-style decomposition + autocorrelation                           */
/* ------------------------------------------------------------------ */

export interface DecompPoint {
  label: string;
  index: number;
  observed: number;
  trend: number;
  seasonal: number;
  residual: number;
  season: Season;
}

export function decompose(regionCode: string, illnessId: string | "all"): DecompPoint[] {
  const series = seriesFor(regionCode, illnessId).filter((p) => !p.forecast);
  const values = series.map((p) => p.cases);
  const half = 26;
  const trend = values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = i - half; k <= i + half; k++) {
      if (k >= 0 && k < values.length) {
        sum += values[k]!;
        n++;
      }
    }
    return sum / n;
  });
  const detrended = values.map((v, i) => v - trend[i]!);
  const byWeek: number[][] = Array.from({ length: WEEKS_PER_YEAR }, () => []);
  series.forEach((p, i) =>
    byWeek[(p.week - 1) % WEEKS_PER_YEAR]!.push(detrended[i]!),
  );
  const seasonalIdx = byWeek.map((arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
  );
  return series.map((p, i) => {
    const wk = (p.week - 1) % WEEKS_PER_YEAR;
    return {
      label: p.label,
      index: i,
      observed: values[i]!,
      trend: Math.round(trend[i]!),
      seasonal: Math.round(seasonalIdx[wk]!),
      residual: Math.round(values[i]! - trend[i]! - seasonalIdx[wk]!),
      season: p.season,
    };
  });
}

/** Autocorrelation function up to `maxLag` weeks — reveals the 52-week cycle. */
export function acf(regionCode: string, illnessId: string | "all", maxLag = 60) {
  const values = seriesFor(regionCode, illnessId)
    .filter((p) => !p.forecast)
    .map((p) => p.cases);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const denom = values.reduce((a, v) => a + (v - mean) ** 2, 0) || 1;
  const out: { lag: number; value: number }[] = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = lag; i < values.length; i++)
      num += (values[i]! - mean) * (values[i - lag]! - mean);
    out.push({ lag, value: Number((num / denom).toFixed(3)) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

export interface Recommendation {
  title: string;
  detail: string;
  urgency: RiskLevel;
}

export function recommendations(a: RegionAssessment): Recommendation[] {
  const ill = a.dominantIllness;
  const base: Recommendation[] = [];
  if (a.risk === "high") {
    base.push(
      {
        title: "Activate regional outbreak response team",
        detail: `Predicted ${a.point.cases.toLocaleString()} cases exceeds the 75th percentile threshold (${Math.round(a.thresholds.p75).toLocaleString()}). Convene the ${a.region.short} epidemiology and surveillance unit within 48 hours.`,
        urgency: "high",
      },
      {
        title: "Pre-position medical supplies",
        detail:
          "Push IV fluids, ORS, rapid diagnostic kits and platelet-capable referral slots to district and provincial hospitals.",
        urgency: "high",
      },
    );
  } else if (a.risk === "moderate") {
    base.push({
      title: "Heighten passive surveillance",
      detail: `Case load sits at the ${a.percentileRank}th historical percentile. Move sentinel sites to weekly reporting and validate consult logs.`,
      urgency: "moderate",
    });
  } else {
    base.push({
      title: "Maintain routine surveillance",
      detail: `Case load is below the 50th percentile (${Math.round(a.thresholds.p50).toLocaleString()}). Sustain baseline PIDSR reporting cadence.`,
      urgency: "low",
    });
  }

  const byIllness: Record<string, Recommendation> = {
    dengue: {
      title: "Deploy vector-control teams",
      detail:
        "Search-and-destroy of breeding sites, targeted fogging in barangays with clustered cases, and 4S campaign amplification.",
      urgency: a.risk,
    },
    lepto: {
      title: "Flood-exposure prophylaxis",
      detail:
        "Distribute doxycycline prophylaxis to flood-exposed residents and responders; post wading advisories in low-lying barangays.",
      urgency: a.risk,
    },
    ili: {
      title: "Vaccination drive",
      detail:
        "Prioritise influenza vaccination for seniors, children under 5, and health workers; reinforce mask use in crowded transit hubs.",
      urgency: a.risk,
    },
    diarrheal: {
      title: "Water quality response",
      detail:
        "Chlorination of community water sources, potability testing by the regional sanitation office, and ORS distribution.",
      urgency: a.risk,
    },
    age: {
      title: "Food-safety inspection sweep",
      detail:
        "Inspect canteens, public markets, and school feeding programs; issue safe food-handling advisories.",
      urgency: a.risk,
    },
    heat: {
      title: "Heat-index mitigation",
      detail:
        "Publish PAGASA heat advisories, adjust outdoor school and work schedules, and set up hydration stations.",
      urgency: a.risk,
    },
  };
  base.push(byIllness[ill.id]!);

  if (a.region.classification === "Highly urban") {
    base.push({
      title: "Dense-settlement focus",
      detail: `${a.region.short} averages ${a.region.density.toLocaleString()} persons/km2 — concentrate response on informal settlements and relocation sites where transmission compounds fastest.`,
      urgency: a.risk,
    });
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; solidColor: string; tone: string }
> = {
  low: {
    label: "Low",
    color: "var(--risk-low)",
    solidColor: "var(--risk-low-solid)",
    tone: "risk-low",
  },
  moderate: {
    label: "Moderate",
    color: "var(--risk-moderate)",
    solidColor: "var(--risk-moderate-solid)",
    tone: "risk-moderate",
  },
  high: {
    label: "High",
    color: "var(--risk-high)",
    solidColor: "var(--risk-high-solid)",
    tone: "risk-high",
  },
};

export const CURRENT_WEEK_INDEX = HIST_WEEKS - 1; // last reported week (2025-W52)

/** The single deterministic "now" the dashboard reasons from: the last reported week. */
export const REPORT_WEEK_INDEX = CURRENT_WEEK_INDEX;
export const REPORT_DATE = weekMeta(CURRENT_WEEK_INDEX).date; // e.g. "2025-12-28"
/**
 * Real-time-derived default for the outbreak outlook: the season that starts
 * after the report date, computed from the fixed calendar boundary — never
 * hardcoded, never a weather feed. Today this resolves to "wet".
 */
export const REPORT_UPCOMING_SEASON: Season = upcomingSeasonForMonth(
  weekMeta(CURRENT_WEEK_INDEX).month,
);
/** Display label for the month an upcoming season starts (for "starts [date]"). */
export const SEASON_START_MONTH: Record<Season, string> = { dry: "Dec", wet: "Jun" };

export function weekLabel(index: number) {
  return weekMeta(index).label;
}

/* ------------------------------------------------------------------ */
/* Pipeline freshness                                                  */
/* ------------------------------------------------------------------ */

export interface PipelineStatus {
  generated_at: string;
  data_through: { date: string; epi_week: string };
  supported_diseases: string[];
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  return fetchJson(`${API_BASE}/status`);
}

/* ------------------------------------------------------------------ */
/* Seasonal outbreak outlook (off the backend /outbreak indicator)     */
/* ------------------------------------------------------------------ */

export interface OutbreakIndicator {
  region: string; // backend region label, e.g. "Region IV-A (CALABARZON)"
  season: Season;
  outbreak: boolean;
  trigger: string; // "both" | "consecutive_high" | "season_p75"
  consecutive_high_n: number;
  season_avg: number;
  season_p75: number;
  n_forecast_weeks: number;
}

const outbreakCache = new Map<string, Partial<Record<Season, OutbreakIndicator>>>();

function regionCodeForApiLabel(label: string): string | null {
  const lowered = label.toLowerCase();
  const direct = REGIONS.find(
    (r) =>
      [r.short, r.name, r.geoName].some((k) => k.toLowerCase() === lowered),
  );
  if (direct) return direct.code;
  const prefix = label.split(" (")[0]!.toLowerCase();
  const byPrefix = REGIONS.find(
    (r) => r.short.toLowerCase() === prefix || r.name.toLowerCase() === prefix,
  );
  return byPrefix ? byPrefix.code : null;
}

async function loadOutbreakData(): Promise<void> {
  const res = await fetchJson<{ items: OutbreakIndicator[] }>("/outbreak");
  for (const item of res.items) {
    const code = regionCodeForApiLabel(item.region);
    if (!code) continue; // "National" and any non-map rows
    const entry = outbreakCache.get(code) ?? {};
    entry[item.season] = { ...item, outbreak: Boolean(item.outbreak) };
    outbreakCache.set(code, entry);
  }
}

/** Per-season outbreak outlook for a region code (dengue pilot). */
export function getOutbreak(
  regionCode: string,
): Partial<Record<Season, OutbreakIndicator>> {
  return outbreakCache.get(regionCode) ?? {};
}

export const OUTBREAK_TRIGGER_LABEL: Record<string, string> = {
  both: "Weekly High run + seasonal average",
  consecutive_high: "3+ consecutive weekly High forecasts",
  season_p75: "Seasonal average above P75",
};
