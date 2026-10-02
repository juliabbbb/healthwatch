import { Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingDown, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  METRIC_META,
  assessRegion,
  classify,
  forecastCategoryMix,
  formatMetric,
  getOutbreak,
  metricValue,
  modelMetrics,
  monthMeta,
  seriesFor,
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
import { AiNarrativeLine } from "./AiNarrative";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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
  onClose?: () => void;
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
  const isSheet = variant === "sheet";

  /* ---------- Derived KPI data ---------- */

  const nextPt = a.forecastWindow[0];
  const nextMonthKpi = nextPt
    ? {
        value: formatMetric(metricValue(nextPt.cases, a.region, mode), mode),
        sub: `95% CI ${formatMetric(metricValue(nextPt.lower, a.region, mode), mode)}–${formatMetric(
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
    : {
        label: upcoming === "wet" ? "Wet · Jun–Nov" : "Dry · Dec–May",
        sub: "Normal seasonal range",
      };

  const histPts = seriesFor(regionCode, illness).filter((p) => !p.forecast);
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
    currentRisk: { level: a.risk, sub: `${a.percentileRank}th %ile of nat'l pool` },
    season: seasonKpi,
    peak: peakKpi,
  };

  const sparkData: SparklinePoint[] = a.forecastWindow.slice(0, 6).map((p) => {
    const val = metricValue(p.cases, a.region, mode);
    return {
      label: MONTH_ABBR[p.month - 1] ?? String(p.month),
      month: formatMonthYear(p.label),
      yhat: val,
      lower: metricValue(p.lower, a.region, mode),
      upper: metricValue(p.upper, a.region, mode),
      risk: classify(val, a.thresholds),
    };
  });

  const riskCounts = riskCountsFor(
    a.forecastWindow
      .slice(0, 6)
      .map((p) => classify(metricValue(p.cases, a.region, mode), a.thresholds)),
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
              {a.region.classification} · {a.region.density.toLocaleString()} persons/km²
            </p>
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

      {/* Outbreak Alert (conditional) */}
      <OutbreakBanner
        regionName={a.region.name}
        season={upcoming}
        indicator={upcomingInd}
        className="mx-5 mt-3 shrink-0"
      />

      {/* Active illness + route class. Sits above the numbers and outside the
          showHeader conditional so the mobile bottom sheet keeps it.

          Hidden entirely for the "all" filter: that selection spans Dengue plus the
          four food-and-waterborne diseases, so no single route class applies to it.
          This deliberately does not follow the `illness === "all" ? "Dengue" : illness`
          pattern the AI surfaces use — those need a concrete disease to key a corpus
          or provider lookup, whereas this row is a label, and naming one disease for
          the whole-panel aggregate would misdescribe what is on screen. */}
      {illness !== "all" && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border/70 px-5 py-2.5 shrink-0">
          <span className="text-sm font-medium leading-none text-foreground">
            {illnessDisplayName(illness)}
          </span>
          {groupForIllness(illness) && (
            <span className="label-caps text-[10px] text-muted-foreground">
              {groupForIllness(illness)}
            </span>
          )}
        </div>
      )}

      {/* 2. Current Status Card (preserved: value, mode toggle, badges, layer selector, stat chips) */}
      <section className="border-b border-border/70 px-5 py-3.5">
        <p className="label-caps text-[10px] text-muted-foreground tracking-wider mb-2.5">
          CURRENT STATUS
        </p>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="label-caps text-[10px]">
              {meta.forecast ? "Predicted" : "Reported"} · {unit}
            </p>
            <p className="font-mono text-3xl sm:text-4xl font-bold leading-none tracking-tight tabular-nums text-foreground mt-1">
              {formatMetric(a.value, mode)}
            </p>

            {onModeChange && (
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
                        "relative z-10 flex-1 text-center text-[10px] font-semibold transition-colors duration-200 py-0.5",
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
            <RiskBadge risk={a.risk} />
            <SeasonTag season={meta.season} label={SEASON_CONFIG[meta.season].display} />
            {a.pooledFallback && a.pooledFallbackReason === "all_illnesses" && (
              <p className="max-w-[13rem] text-right text-[10px] leading-tight text-muted-foreground">
                All Illnesses has no per-disease percentile; tiers use the pooled national
                distribution.
              </p>
            )}
          </div>
        </div>

        {/* Stat Chips */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5">
            <span className="label-caps block">Period</span>
            <span className="font-mono text-xs font-semibold text-foreground truncate block">
              {formatMonthYear(meta.label)}
            </span>
          </div>
          <div
            className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5"
            data-explain="forecast-metric-predicted"
          >
            <span className="label-caps block">Cases</span>
            <span className="font-mono text-xs font-semibold text-foreground truncate block">
              {a.point.cases.toLocaleString()}
            </span>
          </div>
          <div
            className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5"
            data-explain="forecast-metric-change"
          >
            <span className="label-caps block">3-Mo Trend</span>
            <span
              className="inline-flex min-w-0 items-center gap-1 font-mono text-xs font-semibold"
              style={{ color: a.changePct >= 0 ? "var(--risk-high)" : "var(--risk-low)" }}
            >
              {a.changePct >= 0 ? (
                <TrendingUp className="size-3 shrink-0" />
              ) : (
                <TrendingDown className="size-3 shrink-0" />
              )}
              <span className="truncate">
                {a.changePct >= 0 ? "+" : ""}
                {a.changePct}%
              </span>
            </span>
          </div>
          <div
            className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5"
            data-explain="forecast-metric-percentile"
          >
            <span className="label-caps block">Nat'l Rank</span>
            <span className="font-mono text-xs font-semibold text-foreground truncate block">
              {a.percentileRank}th %ile
            </span>
          </div>
          <div className="rounded-lg bg-secondary/40 border border-border/50 px-2.5 py-1.5 col-span-2 sm:col-span-4">
            <span className="label-caps block">Data Source</span>
            <span className="text-[11px] font-medium text-muted-foreground truncate block">
              {meta.forecast
                ? `Prophet Forecast · 95% CI ${formatMetric(
                    metricValue(a.point.lower, a.region, mode),
                    mode,
                  )}–${formatMetric(metricValue(a.point.upper, a.region, mode), mode)}`
                : "DOH Epidemiology Bureau PIDSR Surveillance"}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Epicentra-style KPI Strip */}
      <section className="border-b border-border/70 px-5 py-3.5 shrink-0">
        <KpiStrip data={kpi} />
        {/* Plain-language reading of the headline figure, its thresholds and
            direction. Renders nothing without a corpus row. */}
        <AiNarrativeLine
          regionShort={a.region.short}
          illness={illness}
          surface="kpi_takeaway"
          className="mt-2.5"
        />
      </section>

      {/* 4. Compact 6-Month Forecast + Risk Pills */}
      <section className="border-b border-border/70 px-5 py-3.5 shrink-0">
        <p className="label-caps text-[10px] text-muted-foreground tracking-wider mb-2">
          NEXT 6 MONTHS
        </p>
        <ForecastSparkline data={sparkData} />
        <div className="mt-2">
          <RiskDistributionRow counts={riskCounts} />
        </div>
        {mix.total > 0 && (
          <div className="mt-3 rounded-lg border border-border/50 bg-secondary/30 p-2.5">
            <p className="label-caps text-muted-foreground tracking-wider mb-2">
              DISEASE GROUP MIX · NEXT 6 MONTHS
            </p>
            <CategoryMixBar mix={mix} regionCode={regionCode} mode={mode} illness={illness} />
          </div>
        )}
      </section>

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

      {/* 6. Model Info (unchanged) */}
      <section className="border-b border-border/70 px-5 py-2.5 shrink-0">
        <div className="flex items-center justify-between py-0.5 text-xs">
          <span className="label-caps text-[10px] text-muted-foreground tracking-wider">
            MODEL INFO
          </span>
          <StatusChip className="text-[10px] py-0.5 px-2 text-muted-foreground">
            {validation.label} · MAPE {validation.mape}%
          </StatusChip>
        </div>
        <div className="mt-2 space-y-1.5 pt-0.5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "MAE", v: validation.mae.toLocaleString() },
              { k: "RMSE", v: validation.rmse.toLocaleString() },
              { k: "MAPE", v: `${validation.mape}%` },
            ].map((m) => (
              <div
                key={m.k}
                className="rounded-lg bg-secondary/40 px-2 py-1 border border-border/40"
              >
                <p className="label-caps text-muted-foreground">{m.k}</p>
                <p className="font-mono text-xs font-semibold tabular-nums text-muted-foreground mt-0.5">
                  {m.v}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{validation.note}</p>
        </div>
      </section>

      {/* 7. Pinned CTA */}
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
      key: "Foodborne & Waterborne",
      value: mix.foodWaterBorne,
      color: "var(--chart-2)",
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
        aria-label={`Forecast split: ${segs.map((s) => `${s.key} ${pct(s.value)}%`).join(", ")}`}
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
