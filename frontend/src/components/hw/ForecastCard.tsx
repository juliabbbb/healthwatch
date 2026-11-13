import { ProvisionalTag } from "@/components/hw/ProvisionalTag";
import { AvailabilityNotice } from "./AvailabilityNotice";
import { ResearchComparison } from "./ResearchComparison";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  X,
  Stethoscope,
  Users,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
} from "lucide-react";
import type { DataLayer } from "./MapCanvas";
import { cn } from "@/lib/utils";
import { useAudienceMode } from "@/hooks/useAudienceMode";
import {
  operationalModelForDisease,
  METRIC_META,
  assessRegion,
  availabilityForRegion,
  forecastCategoryMix,
  formatMetric,
  getOutbreak,
  metricValue,
  modelMetrics,
  monthMeta,
  seriesFor,
  ILLNESS_BY_ID,
  OUTBREAK_BENCHMARK_SEASON,
  OUTBREAK_TRIGGER_LABEL,
  REGION_BY_CODE,
  upcomingSeasonForMonth,
  type ForecastCategoryMix,
  type MetricMode,
  type Season,
} from "@/lib/healthwatch/data";
import { formatMonthYear } from "@/utils/formatDate";
import { groupForIllness, illnessDisplayName } from "@/lib/illnessGroups";
import { RiskBadge, SeasonTag } from "./RiskBadge";
import { StatusChip } from "./StatusChip";
import { OutbreakBanner } from "./OutbreakBanner";
import { KpiStrip, type KpiStripData } from "./KpiStrip";
import { ForecastSparkline, type SparklinePoint } from "./ForecastSparkline";
import { RiskDistributionRow, riskCountsFor } from "./RiskDistributionRow";
import { AiInsightLine } from "./AiInsightLine";
import { LiveWeatherCard } from "./LiveWeatherCard";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const SEASON_CONFIG: Record<Season, { label: string; months: string; display: string }> = {
  dry: { label: "Dry", months: "Dec–May", display: "Dry · Dec–May" },
  wet: { label: "Wet", months: "Jun–Nov", display: "Wet · Jun–Nov" },
};

export const SEASON_WINDOW: Record<Season, string> = {
  dry: "Dry · Dec–May",
  wet: "Wet · Jun–Nov",
};

export interface ForecastCardProps {
  regionCode: string;
  illness: string;
  monthIndex: number;
  mode?: MetricMode;
  onModeChange?: (m: MetricMode) => void;
  layer?: DataLayer;
  onLayerChange?: (l: DataLayer) => void;
  onClose?: () => void;
  onSelectMonth?: ((index: number) => void) | undefined;
  variant?: "panel" | "sheet";
  className?: string;
  showHeader?: boolean;
  /** Kept for prop-compat; map-season comparison moved to /seasonality */
  outbreakSeason?: Season;
  onOutbreakSeasonChange?: (s: Season) => void;
}

export function ForecastCard({
  regionCode,
  illness,
  monthIndex,
  mode = "percapita",
  onModeChange,
  onClose,
  onSelectMonth,
  layer = "hotspot",
  onLayerChange,
  variant = "panel",
  className,
  showHeader = true,
  // Kept to avoid breaking index.tsx; comparison now lives on /seasonality
  outbreakSeason = OUTBREAK_BENCHMARK_SEASON,
  onOutbreakSeasonChange: _onOutbreakSeasonChange,
}: ForecastCardProps) {
  const a = assessRegion(regionCode, illness, monthIndex, mode);
  const meta = monthMeta(a.monthIndex);
  const validation = modelMetrics(regionCode, illness);
  const unit = METRIC_META[mode].unit;
  const outlookData = getOutbreak(regionCode, illness);
  const upcoming = upcomingSeasonForMonth(meta.month);
  const upcomingInd = outlookData[upcoming];
  const [aiEnabled] = useAiAnalysisSetting();
  const { mode: audienceMode } = useAudienceMode();
  const isSheet = variant === "sheet";
  const illnessMeta = ILLNESS_BY_ID[illness];
  const availability = availabilityForRegion(regionCode, illness);
  const isForecastUnavailable = illness !== "all" && (availability ? !availability.forecast_available : illnessMeta?.forecastAvailable === false);

  /* ---------- Derived KPI data ---------- */

  const nextPt = a.forecastWindow.find((point) => point.forecast && Number.isFinite(point.cases));
  const nextMonthKpi = isForecastUnavailable
    ? { value: "—", sub: availability?.message ?? (illnessMeta?.forecastAvailable === false ? illnessMeta.unavailableReason : undefined) ?? "Forecast not available" }
    : nextPt
    ? {
        value: formatMetric(metricValue(nextPt.cases, a.region, mode), mode),
        sub: `${nextPt.label} · 80% model interval ${formatMetric(metricValue(nextPt.lower, a.region, mode), mode)}–${formatMetric(
          metricValue(nextPt.upper, a.region, mode),
          mode,
        )}`,
      }
    : { value: "—", sub: "No forecast" };

  const seasonKpi = upcomingInd
    ? {
        label: upcoming === "wet" ? "Wet · Jun–Nov" : "Dry · Dec–May",
        sub: upcomingInd.outbreak
          ? `Outbreak signal — ${OUTBREAK_TRIGGER_LABEL[upcomingInd.trigger] ?? upcomingInd.trigger}`
          : "Normal seasonal range",
      }
    : { label: upcoming === "wet" ? "Wet · Jun–Nov" : "Dry · Dec–May", sub: "Seasonal reference unavailable" };

  const histPts = seriesFor(regionCode, illness).filter((p) => !p.forecast && p.raw >= 0 && Number.isFinite(p.cases));
  const peakPt = histPts.length
    ? histPts.reduce((best, p) => (p.cases > best.cases ? p : best))
    : undefined;
  const peakKpi = peakPt
    ? {
        value: formatMetric(metricValue(peakPt.cases, a.region, mode), mode),
        sub: `${formatMonthYear(peakPt.label)} — highest on record`,
      }
    : { value: "—", sub: "No historical data" };

  const kpi: KpiStripData = {
    nextMonth: nextMonthKpi,
    currentRisk: { level: a.risk, sub: Number.isFinite(a.percentileRank) ? `${Number.isFinite(a.percentileRank) ? `${a.percentileRank}th %ile` : "Unavailable"} of nat'l pool` : "Rank unavailable" },
    season: seasonKpi,
    peak: peakKpi,
  };

  const sparkData: SparklinePoint[] = a.forecastWindow.filter((point) => point.forecast).slice(0, 6).map((p) => {
    const val = metricValue(p.cases, a.region, mode);
    return {
      label: MONTH_ABBR[p.month - 1] ?? String(p.month),
      month: formatMonthYear(p.label),
      yhat: val,
      lower: metricValue(p.lower, a.region, mode),
      upper: metricValue(p.upper, a.region, mode),
      risk: assessRegion(regionCode, illness, p.index, mode).risk,
    };
  });

  const riskCounts = riskCountsFor(
    a.forecastWindow.filter((point) => point.forecast).slice(0, 6).map((p) => assessRegion(regionCode, illness, p.index, mode).risk),
  );

  const mix = forecastCategoryMix(regionCode, a.monthIndex, 6);

  return (
    <div
      className={cn(
        isSheet
          ? "w-full space-y-3"
          : "glass-panel w-[22rem] xl:w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl flex flex-col overflow-hidden",
        className,
      )}
    >
      {/* 1. Region Header */}
      {showHeader && (
        <div className="flex items-start justify-between gap-2 border-b border-border/70 px-5 py-3 bg-card/40">
          <div className="min-w-0 flex-1">
            <p className="label-caps">{a.region.short}</p>
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground truncate">
              {a.region.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {audienceMode === "clinical"
                ? `${a.region.classification} · ${a.region.density.toLocaleString()} persons/km²`
                : "Philippine Administrative Region · Community Health Outlook"}
            </p>
            {illnessMeta?.provisional && <ProvisionalTag note={illnessMeta.provisionalNote} />}
            {!illnessMeta?.provisional && availability?.source_status === "provisional" && <p className="mt-1 text-xs text-muted-foreground">Provisional source interpretation</p>}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border border-border/70 bg-secondary/50">
                {audienceMode === "clinical" ? (
                  <>
                    <Stethoscope className="size-3 text-primary shrink-0" />
                    <span>Healthcare Worker Mode</span>
                  </>
                ) : (
                  <>
                    <Users className="size-3 text-primary shrink-0" />
                    <span>General Public Mode</span>
                  </>
                )}
              </span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close region details"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {/* Outbreak Alert (conditional — only for forecast-ready diseases) */}
      {!isForecastUnavailable && (
      <OutbreakBanner
        regionName={a.region.name}
        season={upcoming}
        indicator={upcomingInd}
        className="mx-5 mt-3 shrink-0"
      />
      )}

      <AvailabilityNotice regionCode={regionCode} disease={illness} monthIndex={monthIndex} onSelectMonth={onSelectMonth} />

      {/* 2. Current Status Card */}
      <section className="border-b border-border/70 px-5 py-3.5">
        <p className="label-caps text-xs text-muted-foreground tracking-wider mb-2.5">
          {audienceMode === "clinical" ? "CURRENT SURVEILLANCE STATUS" : "CURRENT COMMUNITY STATUS"}
        </p>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="label-caps text-xs">
              {a.point.forecast ? "Predicted" : "Reported"} · {unit}
            </p>
            <p className="font-mono text-3xl sm:text-4xl font-bold leading-none tracking-tight tabular-nums text-foreground mt-1">
              {formatMetric(a.value, mode)}
            </p>

            {audienceMode === "clinical" && onModeChange && (
              <div
                role="radiogroup"
                aria-label="Metric representation"
                className="relative mt-2.5 inline-flex h-7 w-44 items-center rounded-full border border-border/80 bg-secondary/50 p-0.5 shadow-inner select-none"
              >
                <div
                  className={cn(
                    "absolute top-0.5 bottom-0.5 w-[calc(50%-3px)] rounded-full bg-primary shadow-xs transition-all duration-200 ease-out",
                    mode === "percapita" ? "left-0.5" : "left-[calc(50%+1.5px)]",
                  )}
                  aria-hidden="true"
                />
                {(["percapita", "raw"] as MetricMode[]).map((m) => {
                  const isActive = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => onModeChange(m)}
                      className={cn(
                        "relative z-10 flex-1 text-center text-xs font-semibold transition-colors duration-200 py-0.5",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {METRIC_META[m].short}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {illness === "all" ? <StatusChip>Combined counts</StatusChip> : <RiskBadge risk={a.risk} />}
            <SeasonTag season={meta.season} label={SEASON_CONFIG[meta.season].display} />
            {audienceMode === "clinical" && onLayerChange && (
              <div className="mt-1 inline-flex rounded-lg border border-border/70 p-0.5 bg-secondary/30">
                {(["hotspot", "density"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => onLayerChange(l)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition-colors text-center",
                      layer === l
                        ? "bg-primary/20 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stat Chips: Clinical (5 detailed metrics) vs Public (simplified 2-badge summary) */}
        {audienceMode === "clinical" ? (
          <div className="mt-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
              <span className="label-caps text-[11px] block">Period</span>
              <span className="font-mono text-sm font-bold text-foreground truncate block">
                {formatMonthYear(meta.label)}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
              <span className="label-caps text-[11px] block">Cases</span>
              <span className="font-mono text-sm font-bold text-foreground truncate block">
                {formatMetric(a.point.cases, "raw")}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
              <span className="label-caps text-[11px] block">3-Mo Trend</span>
              <span
                className="inline-flex min-w-0 items-center gap-1 font-mono text-sm font-bold"
                style={{ color: !Number.isFinite(a.changePct) ? "var(--muted-foreground)" : a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)" }}
              >
                {!Number.isFinite(a.changePct) ? <Info className="size-3.5 shrink-0" /> : a.changePct >= 0 ? (
                  <TrendingUp className="size-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="size-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {Number.isFinite(a.changePct) ? `${a.changePct >= 0 ? "+" : ""}${a.changePct}%` : "Unavailable"}
                </span>
              </span>
            </div>
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
              <span className="label-caps text-[11px] block">Nat'l Rank</span>
              <span className="font-mono text-sm font-bold text-foreground truncate block">
                {Number.isFinite(a.percentileRank) ? `${a.percentileRank}th %ile` : "Unavailable"}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5 col-span-2 sm:col-span-4">
              <span className="label-caps text-[11px] block">Data Source</span>
              <span className="text-xs font-medium text-muted-foreground truncate block">
                {!Number.isFinite(a.value)
                  ? "No observation or forecast for selected month"
                  : a.point.forecast
                  ? isForecastUnavailable
                    ? "Forecast unavailable for this series"
                    : `${operationalModelForDisease(illness)} Forecast · 80% model interval ${formatMetric(
                      metricValue(a.point.lower, a.region, mode),
                      mode,
                    )}–${formatMetric(metricValue(a.point.upper, a.region, mode), mode)}`
                  : a.point.observation_status === "zero_by_user_relayed_DOH_rule" ? "Zero cases under the user-relayed DOH rule" : "DOH source records"}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
              <span className="label-caps text-[10px] text-muted-foreground block">Forecast Period</span>
              <span className="font-mono text-sm font-bold text-foreground truncate block mt-0.5">
                {formatMonthYear(meta.label)}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
              <span className="label-caps text-[10px] text-muted-foreground block">Case Direction</span>
              <span
                className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold mt-0.5"
                style={{ color: !Number.isFinite(a.changePct) ? "var(--muted-foreground)" : a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)" }}
              >
                {!Number.isFinite(a.changePct) ? <Info className="size-3.5 shrink-0" /> : a.changePct >= 0 ? (
                  <TrendingUp className="size-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="size-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {!Number.isFinite(a.changePct) ? "Unavailable" : a.changePct > 5
                    ? `Increasing (+${a.changePct}%)`
                    : a.changePct < -5
                    ? `Decreasing (${a.changePct}%)`
                    : "Stable Caseload"}
                </span>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 3. Epicentra-style KPI Strip (Healthcare Worker Mode only, forecast-ready diseases) */}
      {audienceMode === "clinical" && !isForecastUnavailable && (
        <section className="border-b border-border/70 px-5 py-3.5 shrink-0">
          <KpiStrip data={kpi} />
        </section>
      )}

      {illness === "all" && <p className="px-5 py-2 text-xs text-muted-foreground">Contributing sources: {a.point.contributors?.join(", ") || "Unavailable"}. Aggregate prediction intervals are unavailable.</p>}
      {a.risk === "unavailable" && <p className="px-5 py-3 text-sm text-muted-foreground" role="status">{illness === "all" ? "Combined counts are descriptive. Select a disease for its regional risk tiers; no combined disease threshold is defined." : "Risk unavailable: this date lacks a valid observation, forecast, or canonical threshold."}</p>}
      {(illness === "Influenza-like Illness" || illness === "Leptospirosis") && <p className="px-5 py-3 text-sm text-muted-foreground">Provisional source interpretation. Case definitions and calendar mapping require source confirmation.</p>}
      {audienceMode === "clinical" && <ResearchComparison disease={illness} region={a.region.name} regionCode={regionCode} />}
      {/* 4. Projected Horizon Sparkline (Healthcare Worker Mode only, forecast-ready diseases) */}
      {audienceMode === "clinical" && !isForecastUnavailable && (
        <section className="border-b border-border/70 px-5 py-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps text-xs text-muted-foreground tracking-wider">
              6-MONTH PROJECTION TRAJECTORY
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              80% model interval (uncalibrated)
            </span>
          </div>
          <ForecastSparkline data={sparkData} />
        </section>
      )}




      {/* 5. Compact AI Insight (gated) */}
      {aiEnabled && (
        <section className="border-b border-border/70 px-5 py-2.5 shrink-0">
          <AiInsightLine
            regionShort={a.region.short}
            regionName={a.region.name}
            monthLabel={meta.label}
            illness={illness}
          />
        </section>
      )}

      {/* 6. Live PAGASA Daily Weather Nowcast & Disease Transmission Alerts */}
      <section className="border-b border-border/70 px-5 py-3 shrink-0">
        <LiveWeatherCard
          regionCode={regionCode}
          illness={illness}

        />
      </section>

      {/* Data-dependent guidance is hidden when the risk is unavailable. */}
      {a.risk !== "unavailable" && (audienceMode === "clinical" ? (
        <>
          {illness === "Dengue" && <section className="border-b border-border/70 px-5 py-3 shrink-0 bg-secondary/15">
            <div className="flex items-center justify-between mb-2">
              <span className="label-caps text-xs text-primary font-bold tracking-wider flex items-center gap-1.5">
                <Stethoscope className="size-3.5 text-primary" /> CLINICAL SURGE &amp; TRIAGE PROTOCOL
              </span>
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                {a.risk} Risk Protocol
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-border/60 bg-card/80 p-2.5 space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-primary" /> Hospital Capacity &amp; Logistics Buffer
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {a.risk === "high"
                    ? "Surge threshold exceeded. Buffer 20%+ hospital bed capacity, pre-position 100+ L IV fluids/ORS, and notify provincial blood centers for platelet concentrate readiness."
                    : a.risk === "moderate"
                      ? "Elevated caseload. Inspect hydration stock buffers, review triage algorithms, and audit clinical diagnostic supplies."
                      : "Baseline operational status. Standard PIDSR weekly reporting; maintain routine buffer supplies."}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/80 p-2.5 space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" /> Diagnostic &amp; Sentinel Directives
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Ensure Dengue NS1 / IgM rapid diagnostic test (RDT) kits and water sampling culture media are distributed to Rural Health Units (RHUs).
                </p>
              </div>
            </div>
          </section>}

          {/* Model Statistical Validation Panel (forecast-ready diseases only) */}
          {!isForecastUnavailable && (
          <section className="border-b border-border/70 px-5 py-2.5 shrink-0">
            <div className="flex items-center justify-between py-0.5 text-xs">
              <span className="label-caps text-xs text-muted-foreground tracking-wider">
                MODEL VALIDATION (PROPHET)
              </span>
              <StatusChip className="text-xs py-0.5 px-2.5 text-muted-foreground">
                {validation.label} · MAPE {Number.isFinite(validation.mape) ? `${validation.mape.toFixed(2)}%` : "Unavailable"}
              </StatusChip>
            </div>
            <div className="mt-2 space-y-1.5 pt-0.5">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "MAE", v: Number.isFinite(validation.mae) ? validation.mae.toLocaleString(undefined,{maximumFractionDigits:2}) : "Unavailable" },
                  { k: "RMSE", v: Number.isFinite(validation.rmse) ? validation.rmse.toLocaleString(undefined,{maximumFractionDigits:2}) : "Unavailable" },
                  { k: "MAPE", v: Number.isFinite(validation.mape) ? `${validation.mape.toFixed(2)}%` : "Unavailable" },
                ].map((m) => (
                  <div
                    key={m.k}
                    className="rounded-lg bg-secondary/40 px-2 py-1.5 border border-border/40"
                  >
                    <p className="label-caps text-[11px] text-muted-foreground">{m.k}</p>
                    <p className="font-mono text-sm font-bold tabular-nums text-foreground mt-0.5">
                      {m.v}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{validation.note} Scored evaluation months: {validation.folds}; a short window does not establish reliable performance.</p>
            </div>
          </section>
          )}
        </>
      ) : (
        /* General Public Mode: Household 4S Guide & Emergency Warning Signs */
        <section className="border-b border-border/70 px-5 py-3.5 shrink-0 bg-secondary/15">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps text-xs text-primary font-bold tracking-wider flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" /> COMMUNITY HEALTH &amp; FAMILY GUIDE
            </span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">
              {a.risk} Alert
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Action Checklist */}
            <div className="rounded-lg border border-border/60 bg-card/80 p-3 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                {illness === "Dengue" ? "DOH 4S Strategy to Protect Your Family"
                  : illness === "Leptospirosis" ? "Flood-Water Safety Precautions"
                  : illness === "Influenza-like Illness" ? "Respiratory Illness Prevention"
                  : "Safe Water & Hygiene Precautions"}
              </p>
              {illness === "Dengue" ? (
                <ul className="space-y-1.5 text-[11px] text-muted-foreground pl-1">
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">1. Search &amp; Destroy:</strong> Empty water drums, buckets, tires, and flower pot plates where mosquitoes breed.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">2. Self-Protection:</strong> Apply DEET/citronella insect repellent and wear long-sleeved clothing.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">3. Seek Early Consultation:</strong> If fever lasts &gt;2 days, visit your nearest Barangay Health Center immediately.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">4. Say Yes to Fogging:</strong> Support localized misting during declared hotspot cluster outbreaks.
                  </li>
                </ul>
              ) : illness === "Leptospirosis" ? (
                <ul className="space-y-1.5 text-[11px] text-muted-foreground pl-1">
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">1. Avoid Floodwater:</strong> Do not wade or swim in floodwater, especially with open wounds or cuts.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">2. Wear Protective Footwear:</strong> Use boots or waterproof footwear when walking through flooded or muddy areas.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">3. Seek Immediate Care:</strong> If you develop fever, muscle pain, or dark-colored urine after flood exposure, go to the nearest health center.
                  </li>
                </ul>
              ) : illness === "Influenza-like Illness" ? (
                <ul className="space-y-1.5 text-[11px] text-muted-foreground pl-1">
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">1. Cover Coughs &amp; Sneezes:</strong> Use a tissue or your elbow, and dispose of tissues properly.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">2. Practice Handwashing:</strong> Wash hands frequently with soap, especially after being in public spaces.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">3. Stay Home When Sick:</strong> If you have fever with cough or sore throat, rest at home and avoid crowded places.
                  </li>
                </ul>
              ) : (
                <ul className="space-y-1.5 text-[11px] text-muted-foreground pl-1">
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">1. Boil Drinking Water:</strong> Roll-boil tap or well water for at least 1–2 minutes before drinking.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">2. Food Safety:</strong> Eat thoroughly cooked meals while still warm; avoid questionable raw street foods.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground shrink-0">3. Hand Hygiene:</strong> Wash hands thoroughly with soap for 20 seconds before eating and after using the restroom.
                  </li>
                </ul>
              )}
            </div>

            {/* Red-Flag Symptoms / Emergency Warning Signs */}
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 space-y-1 text-destructive">
              <p className="font-bold text-xs flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" /> When to Rush to the Hospital / ER
              </p>
              <p className="text-[11px] leading-relaxed opacity-90">
                Go to the nearest emergency clinic if you experience: severe abdominal pain, persistent vomiting, bleeding gums or nose, blood in stool, or sudden extreme weakness.
              </p>
            </div>
          </div>
        </section>
      ))}



      {/* 8. Pinned CTA */}
      <div
        className={cn(
          "px-5 py-3",
          isSheet
            ? "sticky bottom-0 bg-card pb-6 pt-3 border-t border-border/70"
            : "sticky bottom-0 bg-card rounded-b-xl z-10 border-t border-border/70",
        )}
      >
        <Link
          to="/seasonality"
          search={{ region: regionCode }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 hover:shadow active:scale-[0.99]"
        >
          Open region analysis <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

interface CategoryMixBarProps {
  mix: ForecastCategoryMix;
  regionCode: string;
  mode: MetricMode;
  illness: string;
}

function CategoryMixBar({ mix, regionCode, mode, illness }: CategoryMixBarProps) {
  const region = REGION_BY_CODE[regionCode]!;
  const conv = (v: number) => formatMetric(metricValue(v, region, mode), mode);
  const isDengue = illness === "Dengue";
  const segs = [
    { key: "Dengue", value: mix.dengue, color: "var(--chart-1)", show: true },
    {
      key: "Food-Borne",
      value: mix.foodBorne,
      color: "var(--chart-2)",
      show: !isDengue,
    },
    {
      key: "Water-Borne",
      value: mix.waterBorne,
      color: "var(--chart-3)",
      show: !isDengue,
    },
  ].filter((s) => s.show && s.value > 0);
  if (!segs.length) return null;
  const shares = segs.map((s) => s.value);
  const denominator = shares.reduce((a, b) => a + b, 0);
  if (!denominator) return null;
  const pct = (v: number) => ((v / denominator) * 100).toFixed(0);

  return (
    <div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="figure"
        aria-label={`Forecast split: ${segs
          .map((s) => `${s.key} ${pct(s.value)}%`)
          .join(", ")}`}
      >
        {segs.map((s) => (
          <div
            key={s.key}
            className="h-full shrink-0 transition-[width] duration-500"
            style={{ width: `${pct(s.value)}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {segs.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-2 text-[10px]">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: s.color }}
                aria-hidden="true"
              />
              <span className="truncate">{s.key}</span>
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {conv(s.value)}
              <span className="ml-1 text-muted-foreground">({pct(s.value)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
