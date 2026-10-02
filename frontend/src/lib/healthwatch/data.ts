/**
 * HEALTHWATCH data layer.
 *
 * Sources real DOH surveillance served by the FastAPI backend (src/api.py)
 * over the relational DB (Supabase Postgres) — the dengue case line-list
 * (2019-01 .. 2026-08) plus the four DOH FWD line-lists (raw files run to a
 * partial 2026-09; the reported window ends at the last complete month,
 * 2026-08, and the API trims the in-progress month at hot-load). Dengue and
 * FWD both cover 18 regions incl. NIR; acute viral hepatitis stops at
 * 2025-09. Every disease runs its own independent monthly
 * series/forecast/risk; the "Food and Waterborne Diseases" grouping is a
 * presentation tag only.
 *
 * Series, validation metrics and outbreak probes are fetched once at startup
 * via `loadHealthwatchData()` (one /dashboard call per disease); every
 * component then reads the caches synchronously, keeping render output stable
 * across renders/SSR. The shared calendar spans 2019-01 .. 2027-08 so the
 * "All Illnesses" view is a genuine per-month sum of the five diseases.
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
    code: "450000000",
    name: "Negros Island Region",
    short: "NIR",
    island: "Visayas",
    geoName: "Negros Island Region (NIR)",
    lat: 10.1,
    lng: 122.9,
    classification: "Rural-urban mix",
    density: 295,
    population: 4560784,
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
  id: string; // canonical API disease label (backend SUPPORTED_DISEASES)
  name: string;
  shortName: string;
  group: "Dengue" | "Food and Waterborne Diseases";
  driver: string;
  peakMonth: number; // month-of-year of climatological peak
  season: Season;
  amplitude: number; // seasonal swing strength
  baseRate: number; // cases / 100k / month
  trend: number; // yearly multiplicative drift
}

/** Presentation grouping only — the pipeline runs each disease independently. */
export const DISEASE_GROUPS = {
  Dengue: "Dengue",
  "Acute Bloody Diarrhea": "Food and Waterborne Diseases",
  Cholera: "Food and Waterborne Diseases",
  "Typhoid Fever": "Food and Waterborne Diseases",
  "Acute Viral Hepatitis": "Food and Waterborne Diseases",
} as const;

export const ILLNESSES: Illness[] = [
  {
    id: "Dengue",
    name: "Dengue",
    shortName: "Dengue",
    group: "Dengue",
    driver: "Aedes vector density after sustained rainfall",
    peakMonth: 8,
    season: "wet",
    amplitude: 1.15,
    baseRate: 1.6,
    trend: 0.045,
  },
  {
    id: "Acute Bloody Diarrhea",
    name: "Acute Bloody Diarrhea",
    shortName: "ABD",
    group: "Food and Waterborne Diseases",
    driver: "Fecal-oral contamination of water and food",
    peakMonth: 9,
    season: "wet",
    amplitude: 0.55,
    baseRate: 0.08,
    trend: -0.01,
  },
  {
    id: "Cholera",
    name: "Cholera",
    shortName: "Cholera",
    group: "Food and Waterborne Diseases",
    driver: "Contaminated drinking water and poor sanitation",
    peakMonth: 9,
    season: "wet",
    amplitude: 0.8,
    baseRate: 0.02,
    trend: -0.05,
  },
  {
    id: "Typhoid Fever",
    name: "Typhoid Fever",
    shortName: "Typhoid",
    group: "Food and Waterborne Diseases",
    driver: "Food and water contaminated with Salmonella Typhi",
    peakMonth: 9,
    season: "wet",
    amplitude: 0.5,
    baseRate: 0.06,
    trend: -0.02,
  },
  {
    id: "Acute Viral Hepatitis",
    name: "Acute Viral Hepatitis",
    shortName: "Hep A",
    group: "Food and Waterborne Diseases",
    driver: "Fecal-oral transmission linked to hygiene and sanitation",
    peakMonth: 9,
    season: "wet",
    amplitude: 0.4,
    baseRate: 0.03,
    trend: -0.03,
  },
];

/**
 * DOH definitions behind the reported-cases breakdown. Keyed by the canonical
 * disease id so each disease surfaces its own classification rules — dengue
 * uses the final/clinical split from the case line-lists, FWD line-lists carry
 * a single Suspect / Probable / Confirmed class. Shared by the methodology
 * "Diseases covered" disclosure and the compare module's dimension tooltip.
 * Source: DOH dengue line-list; DOH FWD line-lists.
 */
export interface ReportedCaseNotes {
  disclaimer: readonly string[];
  heading: string;
  classes: readonly { label: string; definition: string }[];
  source: string;
}

const DENGUE_CASE_NOTES: ReportedCaseNotes = {
  disclaimer: [
    "Reported cases included in this request consist of suspect, probable, and confirmed cases (see definition below).",
    "Reported deaths are unofficial and are used for surveillance purposes only. The official source of mortality data is the Philippine Statistics Authority (PSA).",
  ],
  heading: "Dengue Case Classification",
  classes: [
    {
      label: "Suspect",
      definition:
        "A previously well person with acute febrile illness of 2-7 days duration with clinical signs and symptoms of dengue.",
    },
    {
      label: "Probable",
      definition: "A suspect case with positive dengue IgM antibody test.",
    },
    {
      label: "Confirmed",
      definition:
        "A suspected case with positive results for viral culture isolation, Polymerase Chain Reaction, or Dengue NS1 antigen test.",
    },
  ],
  source: "Source: DOH DM No. 2024-0333; DOH dengue case line-list",
};

const FWD_CASE_NOTES: ReportedCaseNotes = {
  disclaimer: [
    "Reported cases included in this request consist of suspect, probable, and confirmed cases (see definition below).",
    "Reported deaths are unofficial and are used for surveillance purposes only. The official source of mortality data is the Philippine Statistics Authority (PSA).",
  ],
  heading: "DOH FWD Case Classification",
  classes: [
    {
      label: "Suspect",
      definition:
        "A patient meeting the clinical case definition for the food/waterborne disease, reported through the field surveillance network.",
    },
    {
      label: "Probable",
      definition:
        "A suspect case with a positive rapid diagnostic result or an epidemiological link to a confirmed case.",
    },
    {
      label: "Confirmed",
      definition:
        "A suspect or probable case with positive laboratory confirmation (culture, serology, or molecular test).",
    },
  ],
  source: "Source: DOH FWD line-list",
};

/** Reported-case classification notes per canonical disease id. */
export const REPORTED_CASE_NOTES: Record<string, ReportedCaseNotes> = {
  Dengue: DENGUE_CASE_NOTES,
  "Acute Bloody Diarrhea": FWD_CASE_NOTES,
  Cholera: FWD_CASE_NOTES,
  "Typhoid Fever": FWD_CASE_NOTES,
  "Acute Viral Hepatitis": FWD_CASE_NOTES,
};

/** One-line source attribution per disease for the reported-case tables. */
export const REPORTED_SOURCE: Record<string, string> = {
  Dengue: "Source: DOH dengue case line-list (2019-2026)",
  "Acute Bloody Diarrhea": "Source: DOH FWD line-list (2019-2026)",
  Cholera: "Source: DOH FWD line-list (2019-2026)",
  "Typhoid Fever": "Source: DOH FWD line-list (2019-2026)",
  "Acute Viral Hepatitis": "Source: DOH FWD line-list (2019-2026)",
};

/** Resolve display notes (and source) for any illness selection, incl. "all". */
export function caseNotesFor(illness: string): ReportedCaseNotes {
  return REPORTED_CASE_NOTES[illness] ?? DENGUE_CASE_NOTES;
}

export const ILLNESS_BY_ID = Object.fromEntries(ILLNESSES.map((i) => [i.id, i]));

export const MONTHS_PER_YEAR = 12;
/**
 * Observed monthly rows per region served by the backend on the shared
 * calendar: 2019-01 through 2026-08 (92 months) — the last COMPLETE month.
 * The in-progress current month (2026-09) is never served as reported (the
 * API trims it at hot-load), so the reported window ends at the previous
 * complete month. Dengue runs the same span; acute viral hepatitis stops at
 * 2025-09.
 */
export const HIST_MONTHS = 92;
/** Shared forecast months on the axis: 2026-09 through 2027-08 (12 months). */
export const FORECAST_MONTHS = 12;
export const TOTAL_MONTHS = HIST_MONTHS + FORECAST_MONTHS;

/** First calendar year of the shared axis (2019-01 corresponds to index 0). */
export const ANCHOR_YEAR = 2019;

export function monthMeta(index: number) {
  const y = ANCHOR_YEAR + Math.floor(index / 12);
  const m = (index % 12) + 1;
  return {
    year: y,
    month: m,
    label: `${y}-${String(m).padStart(2, "0")}`,
    date: `${y}-${String(m).padStart(2, "0")}-01`,
    season: seasonForMonth(m),
    forecast: index >= HIST_MONTHS,
  };
}

/**
 * Global month index for a "YYYY-MM" label (shared-calendar anchor). Returns
 * -1 for labels outside the axis.
 */
export function indexForYearMonth(year: number, month: number): number {
  const i = (year - ANCHOR_YEAR) * 12 + (month - 1);
  return i >= 0 && i < TOTAL_MONTHS ? i : -1;
}

export interface MonthPoint {
  index: number;
  year: number;
  month: number; // 1-12
  label: string; // 2026-08
  date: string; // ISO date of month start
  season: Season;
  forecast: boolean;
  cases: number; // reported (historical) or predicted
  lower: number;
  upper: number;
  raw: number; // unadjusted model output (may be negative / spiked)
  adjusted: boolean; // true when a post-processing rule changed the value
  adjustReason?: string;
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

/* ------------------------------------------------------------------ */
/* Data loading — live FastAPI server over the relational DB           */
/* ------------------------------------------------------------------ */

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

const seriesCache = new Map<string, MonthPoint[]>();
const metricsCache = new Map<string, ModelMetrics>();
const outbreakCache = new Map<string, Partial<Record<Season, OutbreakIndicator>>>();

async function fetchJson<T>(path: string, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`API ${path} failed: HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * Math.min(i + 1, 3)));
    }
  }
  throw lastErr;
}

/**
 * Overrides the static REGIONS population fields with latest figures served
 * by GET /regions (REGION_META, itself sourced from the PSA census CSV).
 * Mutating the region objects in place propagates through REGION_BY_CODE /
 * REGION_BY_GEONAME because they hold the same references. Falls back to the
 * static values when the API is unreachable.
 */
async function hydratePopulations(): Promise<void> {
  try {
    const regions = await fetchJson<Region[]>("/regions");
    const byCode = new Map(regions.map((r) => [r.code, r.population]));
    for (const region of REGIONS) {
      const pop = byCode.get(region.code);
      if (typeof pop === "number") region.population = pop;
    }
  } catch (err) {
    console.warn("[healthwatch] population hydration failed; using static values.", err);
  }
}

/**
 * Fetches every region's series, validation metrics and outbreak data for each
 * disease (one /dashboard call per disease, run in parallel) plus the static
 * region populations. Resolves before the router renders any route (gated in
 * __root.tsx) so all downstream components can keep reading caches
 * synchronously. The "all" aggregate (true per-month sum of the five
 * diseases) is derived client-side after every disease series lands.
 */
export async function loadHealthwatchData(): Promise<void> {
  interface DashboardResponse {
    disease: string;
    series: Record<string, MonthPoint[]>;
    metrics: Record<
      string,
      {
        mae: number;
        rmse: number;
        mape: number;
        months: number;
        confidence: { label: string; tone: "low" | "moderate" | "high" };
      }
    >;
    outbreak: OutbreakIndicator[];
    /** Region x calendar-month P50/P75: the hotspot tiering basis. */
    thresholds?: { region_code: string; month: number; p50: number; p75: number }[];
  }

  await hydratePopulations();

  const diseases = ILLNESSES.map((i) => i.id);
  const codeByShort = Object.fromEntries(REGIONS.map((r) => [r.short, r.code]));

  await Promise.all(
    diseases.map(async (disease) => {
      try {
        const res = await fetchJson<DashboardResponse>(
          `/dashboard?disease=${encodeURIComponent(disease)}`,
        );

        for (const [short, points] of Object.entries(res.series)) {
          const code = codeByShort[short];
          if (!code) continue;
          seriesCache.set(`${code}:${disease}`, normalizeSeries(points));
        }

        for (const [short, m] of Object.entries(res.metrics)) {
          const code = codeByShort[short];
          if (!code) continue;
          metricsCache.set(`${code}:${disease}`, {
            folds: m.months,
            label: m.confidence.label,
            tone: m.confidence.tone,
            note:
              m.confidence.tone === "low"
                ? "Model error is small relative to monthly case counts."
                : m.confidence.tone === "moderate"
                  ? "Reasonable accuracy on holdout months."
                  : "Volatile series inflates error metrics.",
            mae: m.mae,
            rmse: m.rmse,
            mape: m.mape,
          });
        }

        if (res.thresholds?.length) {
          setHotspotThresholds(disease, res.thresholds);
        }

        for (const item of res.outbreak) {
          const code = regionCodeForApiLabel(item.region);
          if (!code) continue;
          const entry = outbreakCache.get(`${code}:${disease}`) ?? {};
          entry[item.season] = { ...item, outbreak: Boolean(item.outbreak) };
          outbreakCache.set(`${code}:${disease}`, entry);
        }
      } catch (err) {
        console.warn(`[healthwatch] dashboard load failed for ${disease}`, err);
      }
    }),
  );

  // Derive the "all" aggregate: per-month sum across the five diseases, plus
  // an outbreak probe that fires for a season when any member disease flags.
  for (const region of REGIONS) {
    buildAllSeries(region.code);
    buildAllOutbreak(region.code);
  }
}

/** Sentinel raw value on fabricated no-data months of the shared axis. */
const NO_DATA_RAW = -1;

/**
 * Aligns a backend series (native per-disease anchor) onto the global shared
 * calendar. Months before a disease's line-list began are represented by
 * zero-case sentinel points (raw < 0) so arrays stay dense and indexable, but
 * pools/decomposition exclude them. Trailing months are never appended: each
 * disease's series ends at its own last real (observed or forecast) month —
 * "All Illnesses" still spans the widest window because it sums whatever
 * exists per index. Returns [] when the region has no real data for the
 * disease at all.
 */
export function normalizeSeries(points: MonthPoint[]): MonthPoint[] {
  if (!points.length) return [];
  const dest: MonthPoint[] = [];
  let last = -1;
  for (const p of points) {
    const gi = indexForYearMonth(p.year, p.month);
    if (gi < 0) continue;
    while (dest.length < gi) dest.push(emptyMonth(dest.length));
    dest[gi] = p;
    last = gi;
  }
  if (last < 0) return [];
  return dest;
}

function emptyMonth(index: number): MonthPoint {
  const meta = monthMeta(index);
  return {
    index,
    year: meta.year,
    month: meta.month,
    label: meta.label,
    date: meta.date,
    season: meta.season,
    forecast: index >= HIST_MONTHS,
    cases: 0,
    lower: 0,
    upper: 0,
    raw: NO_DATA_RAW,
    adjusted: false,
  };
}

function buildAllSeries(code: string): void {
  const diseases = ILLNESSES.map((i) => i.id);
  let any = false;
  const out: MonthPoint[] = [];
  for (let i = 0; i < TOTAL_MONTHS; i++) {
    let cases = 0;
    let lower = 0;
    let upper = 0;
    let raw = 0;
    let forecast = true;
    for (const d of diseases) {
      const p = seriesCache.get(`${code}:${d}`)?.[i];
      if (!p) continue;
      any = true;
      cases += p.cases;
      lower += p.lower;
      upper += p.upper;
      if (p.raw >= 0) raw += p.raw;
      if (!p.forecast) forecast = false;
    }
    const meta = monthMeta(i);
    out[i] = {
      index: i,
      year: meta.year,
      month: meta.month,
      label: meta.label,
      date: meta.date,
      season: meta.season,
      forecast,
      cases: Math.round(cases),
      lower,
      upper,
      raw: Math.round(raw),
      adjusted: false,
    };
  }
  if (any) seriesCache.set(`${code}:__all`, out);
}

function buildAllOutbreak(code: string): void {
  const diseases = ILLNESSES.map((i) => i.id);
  const union: Partial<Record<Season, OutbreakIndicator>> = {};
  for (const d of diseases) {
    for (const [season, ind] of Object.entries(outbreakCache.get(`${code}:${d}`) ?? {})) {
      if (ind?.outbreak && !union[season as Season]) union[season as Season] = ind;
    }
  }
  if (Object.keys(union).length) outbreakCache.set(`${code}:__all`, union);
}

/** Starts loading immediately on module import. */
export const dataReady = loadHealthwatchData();

/** Cached per region+illness so charts and the map share one source of truth. */
export function getSeries(regionCode: string, illnessId: string): MonthPoint[] {
  const key = illnessId === "all" ? "__all" : illnessId === "" ? undefined : illnessId;
  if (!key) return [];
  return seriesCache.get(`${regionCode}:${key}`) ?? [];
}

function getTotalSeries(regionCode: string): MonthPoint[] {
  return getSeries(regionCode, "__all");
}

export function seriesFor(regionCode: string, illnessId: string | "all"): MonthPoint[] {
  return illnessId === "all" ? getTotalSeries(regionCode) : getSeries(regionCode, illnessId);
}

/* ------------------------------------------------------------------ */
/* Forecast disease-group mix (NEXT 6 MONTHS breakdown)               */
/* ------------------------------------------------------------------ */

export interface ForecastCategoryMix {
  /** Summed next-6-month forecast raw case counts, per disease group. */
  dengue: number;
  foodWaterBorne: number;
  total: number;
}

/**
 * Sums each disease's own forecast window (next `months` forecast points from
 * `monthIndex`, or fewer near a series' natural end) grouped by disease group.
 * Reads the per-disease series directly so the sum respects each disease's real
 * terminal month instead of the shared calendar tail.
 *
 * The two buckets are Dengue and the food-and-waterborne group. All four FWD
 * diseases can spread by either route depending on the source of an outbreak,
 * so they are never split by route here.
 */
export function forecastCategoryMix(
  regionCode: string,
  monthIndex: number,
  months: number = FORECAST_MONTHS,
): ForecastCategoryMix {
  const mix: ForecastCategoryMix = { dengue: 0, foodWaterBorne: 0, total: 0 };
  for (const disease of ILLNESSES) {
    const series = getSeries(regionCode, disease.id);
    for (let i = monthIndex + 1; i <= monthIndex + months; i++) {
      const p = series[i];
      if (!p || !p.forecast || p.raw < 0) continue;
      if (disease.group === "Dengue") mix.dengue += p.cases;
      else mix.foodWaterBorne += p.cases;
      mix.total += p.cases;
    }
  }
  mix.total = Math.round(mix.total);
  mix.dengue = Math.round(mix.dengue);
  mix.foodWaterBorne = Math.round(mix.foodWaterBorne);
  return mix;
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

/** Classification metric: raw monthly case counts or cases per 100k residents. */
export type MetricMode = "raw" | "percapita";

export const METRIC_META: Record<MetricMode, { label: string; short: string; unit: string }> = {
  raw: { label: "Raw case count", short: "Raw cases", unit: "cases/month" },
  percapita: { label: "Cases per 100,000 population", short: "Per 100k", unit: "per 100k/month" },
};

/**
 * Convert a case count into the active metric for a region.
 *
 * The per-100k result is deliberately NOT rounded. Tiering compares a value
 * against a P50/P75 pair, and dividing both sides by the same population is
 * order-preserving, so rounding can only destroy the ordering: a region with
 * p50=1.0 and p75=1.5 cases becomes 0.0074 and 0.0111 per-100k, and rounding
 * both to 0.01 collapses a strict inequality into a tie. Display rounding
 * belongs to `formatMetric`, not here.
 */
export function metricValue(cases: number, region: Region, mode: MetricMode): number {
  if (mode === "raw") return cases;
  return (cases / region.population) * 100000;
}

export function formatMetric(value: number, mode: MetricMode): string {
  if (mode === "raw") return Math.round(value).toLocaleString();
  if (value > 0 && value < 0.1) return "<0.1";
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Circular month distance; within ±1 month counts as the same seasonal window. */
const inSeasonWindow = (m: number, monthOfYear?: number) => {
  if (monthOfYear === undefined) return true;
  const d = Math.abs(m - monthOfYear);
  return Math.min(d, MONTHS_PER_YEAR - d) <= 1;
};

const poolCache = new Map<string, number[]>();

/**
 * Sorted national distribution: every historical month from every region for
 * the selected illness, expressed in the active metric and restricted to the
 * same calendar-month window, so a region is judged against the seasonal norm
 * rather than the annual average. Pooling across regions is what makes the raw
 * vs per-capita toggle meaningful: in raw mode large-population regions
 * dominate the upper percentiles, while per-capita mode surfaces genuinely
 * intense transmission in smaller regions.
 */
export function pooledValues(
  illnessId: string | "all",
  monthOfYear: number | undefined,
  mode: MetricMode,
): number[] {
  const key = `${illnessId}:${monthOfYear ?? "*"}:${mode}`;
  const hit = poolCache.get(key);
  if (hit) return hit;
  const pooled: number[] = [];
  for (const region of REGIONS) {
    for (const p of seriesFor(region.code, illnessId)) {
      if (p.forecast || p.raw < 0 || !inSeasonWindow(p.month, monthOfYear)) continue;
      pooled.push(metricValue(p.cases, region, mode));
    }
  }
  pooled.sort((a, b) => a - b);
  poolCache.set(key, pooled);
  return pooled;
}

export function getThresholds(
  illnessId: string | "all",
  monthOfYear: number | undefined,
  mode: MetricMode,
): Thresholds {
  const pooled = pooledValues(illnessId, monthOfYear, mode);
  return { p50: percentile(pooled, 0.5), p75: percentile(pooled, 0.75) };
}

/**
 * Which yardstick the Low / Moderate / High tiers are cut against.
 *
 * - `hotspot`  the region's OWN seasonal norm: its historical P50/P75 for that
 *              calendar month, the same percentiles `classify.py` writes to
 *              risk_thresholds.csv and uses to tier the forecasts, re-expressed
 *              in the active metric. Answers "is this region hot for itself?" A
 *              region whose January is always busy reads Moderate in a mild
 *              January, and a quiet region reads High the moment it exceeds its
 *              own norm. Because both sides are converted, the tier is
 *              unit-invariant: a region reads the same in raw and per-100k.
 * - `burden`   the national seasonal distribution pooled across all regions in
 *              the active metric. Answers "is this region's burden big?",
 *              which is what a per-100k view is for.
 *
 * `hotspot` is the default because it is the deployed, validated tiering; the
 * burden basis is the comparison view.
 */
export type TierBasis = "hotspot" | "burden";

export const TIER_BASIS_META: Record<
  TierBasis,
  { label: string; short: string; basisNote: string }
> = {
  hotspot: {
    label: "Hotspot (High tier)",
    short: "Hotspot",
    basisNote:
      "Tiers compare each region against its own seasonal history (its own P50/P75 for this calendar month).",
  },
  burden: {
    label: "Relative burden (national distribution)",
    short: "Burden",
    basisNote:
      "Tiers compare each region against the national seasonal distribution pooled across all regions, in the selected unit (raw cases or per 100k).",
  },
};

export const DEFAULT_TIER_BASIS: TierBasis = "hotspot";

/**
 * Why the hotspot basis was not used for an assessment, if it wasn't. Surfaced
 * in the UI instead of silently changing the map under the user.
 */
export type PooledFallbackReason = "all_illnesses" | "no_threshold_row" | null;

interface ThresholdRow {
  p50: number;
  p75: number;
}

// region_code -> illnessId -> calendar month -> P50/P75, filled from the
// `/dashboard` `thresholds` block so the hotspot basis uses the authoritative
// per-region percentiles rather than a client-side approximation.
const hotspotCache = new Map<string, Map<string, Map<number, ThresholdRow>>>();

export function setHotspotThresholds(
  disease: string,
  rows: { region_code: string; month: number; p50: number; p75: number }[],
): void {
  for (const r of rows) {
    let byIllness = hotspotCache.get(r.region_code);
    if (!byIllness) {
      byIllness = new Map();
      hotspotCache.set(r.region_code, byIllness);
    }
    let byMonth = byIllness.get(disease);
    if (!byMonth) {
      byMonth = new Map();
      byIllness.set(disease, byMonth);
    }
    byMonth.set(r.month, { p50: r.p50, p75: r.p75 });
  }
  poolCache.clear();
}

export function hasHotspotThresholds(): boolean {
  return hotspotCache.size > 0;
}

/** The region's own seasonal P50/P75 for this disease and calendar month. */
export function hotspotThresholds(
  regionCode: string,
  illnessId: string,
  monthOfYear: number,
): Thresholds | null {
  const row = hotspotCache.get(regionCode)?.get(illnessId)?.get(monthOfYear);
  return row ? { p50: row.p50, p75: row.p75 } : null;
}

export interface ResolvedThresholds {
  thresholds: Thresholds;
  /**
   * True ONLY when the pooled national distribution was substituted for the
   * hotspot basis the caller asked for. An explicitly chosen `burden` basis is
   * NOT a fallback, so it reports false.
   */
  pooled: boolean;
  reason: PooledFallbackReason;
}

/**
 * Re-express a raw-count threshold pair in the active metric.
 *
 * `risk_thresholds.csv` stores raw case counts (that is what `classify.py`
 * tiers against), but the dashboard can display per-100k. Comparing a per-100k
 * value to a raw-count threshold silently mislabels the region, so both sides
 * of the comparison must be in the same unit. Returns null when the population
 * is unknown, which sends the caller down the pooled path rather than dividing
 * by zero.
 */
function toMetric(t: Thresholds, region: Region | undefined, mode: MetricMode): Thresholds | null {
  if (mode === "raw") return t;
  const population = region?.population;
  if (!population || population <= 0) return null;
  const per100k = (cases: number) => (cases / population) * 100000;
  return { p50: per100k(t.p50), p75: per100k(t.p75) };
}

export function resolveThresholds(
  regionCode: string,
  illnessId: string | "all",
  monthOfYear: number,
  mode: MetricMode,
  basis: TierBasis = DEFAULT_TIER_BASIS,
): ResolvedThresholds {
  // Fallback yardstick: the national seasonal distribution, already expressed in
  // the active metric by `getThresholds`. Only reached when the hotspot basis
  // was requested but is unavailable.
  const fallback = (): ResolvedThresholds => ({
    thresholds: getThresholds(illnessId, monthOfYear, mode),
    pooled: true,
    reason: "no_threshold_row",
  });
  if (basis !== "hotspot") {
    // The burden basis IS the pooled distribution, so it is the requested
    // yardstick rather than a substitute for another one.
    return { thresholds: getThresholds(illnessId, monthOfYear, mode), pooled: false, reason: null };
  }
  // The hotspot basis needs ONE disease's own percentiles. There is no such
  // thing as a percentile of a summed total (and "All Illnesses" mixes five
  // unrelated case scales), so the aggregate view stays on the pooled
  // distribution and says so.
  if (illnessId === "all") {
    return { ...fallback(), reason: "all_illnesses" };
  }
  const own = hotspotThresholds(regionCode, illnessId, monthOfYear);
  if (!own) return fallback();
  const converted = toMetric(own, REGION_BY_CODE[regionCode], mode);
  if (!converted) return fallback();
  return { thresholds: converted, pooled: false, reason: null };
}

export function classify(value: number, t: Thresholds): RiskLevel {
  if (value > t.p75) return "high";
  if (value >= t.p50) return "moderate";
  return "low";
}

export interface RegionAssessment {
  region: Region;
  monthIndex: number;
  point: MonthPoint;
  mode: MetricMode;
  /** The yardstick the tier was cut against. */
  basis: TierBasis;
  /** point.cases expressed in the active metric (raw cases or per 100k). */
  value: number;
  thresholds: Thresholds;
  /** True when `thresholds` came from the pooled national distribution, not the requested basis. */
  pooledFallback: boolean;
  pooledFallbackReason: PooledFallbackReason;
  risk: RiskLevel;
  percentileRank: number; // 0-100 within the national seasonal distribution
  dominantIllness: Illness;
  /** The 12-month forecast horizon immediately after the assessment month. */
  forecastWindow: MonthPoint[];
  changePct: number;
}

export function assessRegion(
  regionCode: string,
  illnessId: string | "all",
  monthIndex: number,
  mode: MetricMode = "percapita",
  basis: TierBasis = DEFAULT_TIER_BASIS,
): RegionAssessment {
  const region = REGION_BY_CODE[regionCode]!;
  const series = seriesFor(regionCode, illnessId);

  if (!series.length) {
    // A region with no series yet (backend incomplete or unreachable) must not
    // take the dashboard down. Report the requested calendar location with a
    // zeroed point so maps and charts render; the tier falls to Low by
    // construction and the rank lands at the bottom of the national pool.
    const idx = Math.min(Math.max(monthIndex, 0), Math.max(0, TOTAL_MONTHS - 1));
    const safeMeta = monthMeta(idx);
    const point: MonthPoint = {
      index: idx,
      year: safeMeta.year,
      month: safeMeta.month,
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
    const resolved = resolveThresholds(regionCode, illnessId, point.month, mode, basis);
    const dist = pooledValues(illnessId, point.month, mode);
    return {
      region,
      monthIndex: idx,
      point,
      mode,
      basis,
      value: 0,
      thresholds: resolved.thresholds,
      pooledFallback: resolved.pooled,
      pooledFallbackReason: resolved.reason,
      risk: classify(0, resolved.thresholds),
      percentileRank: Math.round(
        (dist.filter((v) => v <= 0).length / Math.max(1, dist.length)) * 100,
      ),
      dominantIllness: ILLNESSES[0]!,
      forecastWindow: [],
      changePct: 0,
    };
  }

  const idx = Math.min(Math.max(monthIndex, 0), series.length - 1);
  const point = series[idx]!;
  const resolved = resolveThresholds(regionCode, illnessId, point.month, mode, basis);
  const value = metricValue(point.cases, region, mode);

  const dist = pooledValues(illnessId, point.month, mode);
  const below = dist.filter((v) => v <= value).length;
  const percentileRank = Math.round((below / Math.max(1, dist.length)) * 100);

  const dominantIllness = ILLNESSES.reduce((best, ill) => {
    const ra =
      metricValue(getSeries(regionCode, ill.id)[idx]?.cases ?? 0, region, mode) /
      (getThresholds(ill.id, point.month, mode).p75 || 1);
    const rb =
      metricValue(getSeries(regionCode, best.id)[idx]?.cases ?? 0, region, mode) /
      (getThresholds(best.id, point.month, mode).p75 || 1);
    return ra > rb ? ill : best;
  }, ILLNESSES[0]!);

  const forecastWindow = series.slice(idx + 1, idx + 1 + FORECAST_MONTHS);
  const prev = series[Math.max(0, idx - 3)]!.cases || 1;
  const changePct = Math.round(((point.cases - prev) / prev) * 100);

  return {
    region,
    monthIndex: idx,
    point,
    mode,
    basis,
    value,
    thresholds: resolved.thresholds,
    pooledFallback: resolved.pooled,
    pooledFallbackReason: resolved.reason,
    risk: classify(value, resolved.thresholds),
    percentileRank,
    dominantIllness,
    forecastWindow,
    changePct,
  };
}

export function assessAll(
  illnessId: string | "all",
  monthIndex: number,
  mode: MetricMode = "percapita",
  basis: TierBasis = DEFAULT_TIER_BASIS,
): RegionAssessment[] {
  return REGIONS.map((r) => assessRegion(r.code, illnessId, monthIndex, mode, basis));
}

export interface NationalDominant {
  illness: Illness;
  /** Summed raw national cases at the month across all regions. */
  cases: number;
  /** National case load expressed in the active metric. */
  metric: number;
}

/**
 * National dominant illness at a month. When `illnessId` is "all" it ranks all
 * five diseases by summed raw national cases (the true primary case driver);
 * when a single illness is selected it returns that illness with its own
 * national load, so the National Snapshot card tracks the active filter.
 */
export function nationalDominant(
  illnessId: string | "all",
  monthIndex: number,
  mode: MetricMode = "percapita",
): NationalDominant {
  const pool = illnessId === "all" ? ILLNESSES : ILLNESSES.filter((i) => i.id === illnessId);
  let best: Illness = ILLNESSES[0]!;
  let bestCases = -1;
  for (const ill of pool) {
    let cases = 0;
    for (const region of REGIONS) {
      const p = getSeries(region.code, ill.id)[monthIndex];
      if (p && p.raw >= 0) cases += p.cases;
    }
    if (cases > bestCases) {
      bestCases = cases;
      best = ill;
    }
  }
  const cases = Math.max(0, bestCases);
  const population = REGIONS.reduce((s, r) => s + r.population, 0);
  return {
    illness: best,
    cases,
    metric: mode === "raw" ? cases : (cases / population) * 100000,
  };
}

/* ------------------------------------------------------------------ */
/* Risk-tier escalation ranking (GET /escalation)                      */
/* ------------------------------------------------------------------ */

/**
 * One row of the pipeline's risk-tier escalation ranking: how many upward
 * risk-tier transitions a region's forecast makes across the 12-month horizon.
 * `tier_climbs` is the sort key -- steepest risers first -- because that is the
 * prioritization order for resource allocation.
 */
export interface EscalationItem {
  region_code: string;
  region: string;
  disease: string;
  rank: number;
  tier_climbs: number;
  net_climb: number;
  n_high_months: number;
  first_high_month: string | null;
  final_tier: string;
}

const escalationCache = new Map<string, EscalationItem[]>();

export async function loadEscalation(disease: string): Promise<EscalationItem[]> {
  const cached = escalationCache.get(disease);
  if (cached) return cached;
  try {
    const res = await fetchJson<{ items: EscalationItem[] }>(
      `/escalation?disease=${encodeURIComponent(disease)}`,
    );
    const items = res.items ?? [];
    escalationCache.set(disease, items);
    return items;
  } catch (err) {
    console.warn(`[healthwatch] escalation load failed for ${disease}`, err);
    return [];
  }
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
 * Walk-forward backtest metrics from the pipeline: the Prophet monthly model
 * is refit every month and scored on holdout months it never saw (two windows,
 * each up to 12 months), reported per region by /metrics/{region}.
 */
export function modelMetrics(regionCode: string, illnessId: string | "all"): ModelMetrics {
  const key = illnessId === "all" ? "Dengue" : illnessId;
  return (
    metricsCache.get(`${regionCode}:${key}`) ?? {
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

export function decompose(
  regionCode: string,
  illnessId: string | "all",
  endIndex?: number,
): DecompPoint[] {
  const series = seriesFor(regionCode, illnessId).filter(
    (p) => (endIndex === undefined ? !p.forecast : p.index <= endIndex) && p.raw >= 0,
  );
  const values = series.map((p) => p.cases);
  const half = 6;
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
  const byMonth: number[][] = Array.from({ length: MONTHS_PER_YEAR }, () => []);
  series.forEach((p, i) => byMonth[(p.month - 1) % MONTHS_PER_YEAR]!.push(detrended[i]!));
  const seasonalIdx = byMonth.map((arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
  );
  return series.map((p, i) => {
    const m = (p.month - 1) % MONTHS_PER_YEAR;
    return {
      label: p.label,
      index: i,
      observed: values[i]!,
      trend: Math.round(trend[i]!),
      seasonal: Math.round(seasonalIdx[m]!),
      residual: Math.round(values[i]! - trend[i]! - seasonalIdx[m]!),
      season: p.season,
    };
  });
}

/** Autocorrelation function up to `maxLag` months — reveals the 12-month cycle. */
export function acf(regionCode: string, illnessId: string | "all", maxLag = 24, endIndex?: number) {
  const values = seriesFor(regionCode, illnessId)
    .filter((p) => (endIndex === undefined ? !p.forecast : p.index <= endIndex) && p.raw >= 0)
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
      detail: `Case load sits at the ${a.percentileRank}th historical percentile. Move sentinel sites to monthly reporting and validate consult logs.`,
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
    Dengue: {
      title: "Deploy vector-control teams",
      detail:
        "Search-and-destroy of breeding sites, targeted fogging in barangays with clustered cases, and 4S campaign amplification.",
      urgency: a.risk,
    },
    "Acute Bloody Diarrhea": {
      title: "Scale safe-water and handwashing interventions",
      detail:
        "Chlorinate communal water points, promote handwashing with soap, and expand ORS availability at rehydration posts.",
      urgency: a.risk,
    },
    Cholera: {
      title: "Augment WASH response",
      detail:
        "Distribute water purification agents, deploy emergency water trucking where supplies are interrupted, and stand up oral rehydration corners.",
      urgency: a.risk,
    },
    "Typhoid Fever": {
      title: "Target food-handler hygiene",
      detail:
        "Inspect food and water outlets, promote safe food-handling, and consider selective typhoid vaccination where transmission is clustered.",
      urgency: a.risk,
    },
    "Acute Viral Hepatitis": {
      title: "Reinforce safe water and sanitation",
      detail:
        "Harden drinking-water sources, reinforce carrier hygiene through handwashing education, and support supportive-care case management.",
      urgency: a.risk,
    },
  };
  const diseaseRec = byIllness[ill.id];
  if (diseaseRec) base.push(diseaseRec);

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

export const getCurrentMonthPHT = (): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(new Date()); // Outputs "YYYY-MM" (e.g., "2026-09")
};

/**
 * Shift the active baseline month by `months` (e.g. -12 .. +12 for the compare
 * slider) and clamp to the valid series range [0, TOTAL_MONTHS - 1]. The
 * baseline itself is always derived from Asia/Manila (PHT, UTC+8).
 */
export function shiftBaselineMonth(months: number): number {
  return Math.max(0, Math.min(TOTAL_MONTHS - 1, CURRENT_MONTH_INDEX + months));
}

/** Formatted PHT date string for the active baseline (e.g. "2026-09"). */
export function formatBaseLinePHT(monthIndex: number = CURRENT_MONTH_INDEX): string {
  return monthMeta(monthIndex).label;
}

/** Human-readable PHT timestamp, e.g. "2026-09-09 14:32 (PHT)". */
export function formatPHTDateTime(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} (PHT)`;
}

export type SeasonalityComponent = "observed" | "trend" | "seasonal" | "residual" | "acf";

export function getMonthIndexFromLabel(label: string): number {
  const parts = label.split("-");
  const yStr = parts[0];
  const mStr = parts[1];
  if (!yStr || !mStr) return HIST_MONTHS - 1;
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return HIST_MONTHS - 1;
  const i = indexForYearMonth(y, m);
  return i >= 0 ? i : HIST_MONTHS - 1;
}

/** Active surveillance baseline date locked to Asia/Manila (PHT, UTC+8). */
export const CURRENT_BASELINE_DATE = getCurrentMonthPHT();
export const CURRENT_MONTH_INDEX = Math.max(
  0,
  Math.min(TOTAL_MONTHS - 1, getMonthIndexFromLabel(CURRENT_BASELINE_DATE)),
);

/** The single dynamic "now" the dashboard reasons from: Asia/Manila current month (e.g. 2026-09). */
export const REPORT_MONTH_INDEX = CURRENT_MONTH_INDEX;
export const REPORT_DATE = monthMeta(CURRENT_MONTH_INDEX).date; // e.g. "2026-09-01"
/**
 * Fixed validation benchmark for the seasonal outbreak indicator. The panel is
 * NOT derived from the current clock: it always shows the frozen 2025-dated
 * probes from outbreak_indicators.csv (fit through 2024-12-31, checked
 * prospectively against observed 2025).
 */
export const OUTBREAK_BENCHMARK_SEASON: Season = "wet";
export const OUTBREAK_BENCHMARK_LABEL = "Validated Outbreak Signal (Jul–Sep 2025 benchmark)";
/** Calendar window each season's benchmark probe describes (2025 validation). */
export const OUTBREAK_BENCHMARK_WINDOW: Record<Season, string> = {
  dry: "Jan–Mar 2025",
  wet: "Jul–Sep 2025",
};

export function monthLabel(index: number) {
  return monthMeta(index).label;
}

/* ------------------------------------------------------------------ */
/* Seasonal outbreak outlook (off the backend /outbreak indicator)     */
/* ------------------------------------------------------------------ */

export interface OutbreakIndicator {
  region: string; // backend region label, e.g. "Central Visayas"
  season: Season;
  outbreak: boolean;
  trigger: string; // "both" | "consecutive_high" | "season_p75"
  consecutive_high_n: number;
  season_avg: number;
  season_p75: number;
  n_forecast_months: number;
}

function regionCodeForApiLabel(label: string): string | null {
  const lowered = label.toLowerCase();
  const direct = REGIONS.find((r) =>
    [r.short, r.name, r.geoName].some((k) => k.toLowerCase() === lowered),
  );
  if (direct) return direct.code;
  const prefix = label.split(" (")[0]!.toLowerCase();
  const byPrefix = REGIONS.find(
    (r) => r.short.toLowerCase() === prefix || r.name.toLowerCase() === prefix,
  );
  return byPrefix ? byPrefix.code : null;
}

/**
 * Per-season outbreak outlook for a region code, scoped to the selected
 * illness (canonical disease id or "all", in which case the probe fires for a
 * season when any member disease flagged).
 */
export function getOutbreak(
  regionCode: string,
  illnessId: string = "Dengue",
): Partial<Record<Season, OutbreakIndicator>> {
  return outbreakCache.get(`${regionCode}:${illnessId === "all" ? "__all" : illnessId}`) ?? {};
}

const CONSECUTIVE_HIGH_N = 3;

export const OUTBREAK_TRIGGER_LABEL: Record<string, string> = {
  both: "Monthly High run + seasonal average",
  consecutive_high: `${CONSECUTIVE_HIGH_N}+ consecutive monthly High forecasts`,
  season_p75: "Seasonal average above P75",
};
