import {
  CURRENT_MONTH_INDEX,
  OUTBREAK_TRIGGER_LABEL,
  REGION_BY_CODE,
  RISK_META,
  assessRegion,
  classify,
  getOutbreak,
  metricValue,
  monthMeta,
  upcomingSeasonForMonth,
  type MetricMode,
} from "@/lib/healthwatch/data";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMonthYear } from "@/utils/formatDate";

/**
 * Compact 12-cell risk strip, one cell per forecast month, colored by the
 * predicted risk tier (GitHub-contribution style). Mounted at the top of the
 * Seasonality page as a first-glance summary; hover shows month, tier and
 * forecast value.
 */
export function HotspotTimeline({
  regionCode,
  illness,
  mode = "percapita",
}: {
  regionCode: string;
  illness: string;
  mode?: MetricMode;
}) {
  const region = REGION_BY_CODE[regionCode];
  if (!region) return null;

  const monthIndex = CURRENT_MONTH_INDEX;
  const a = assessRegion(regionCode, illness, monthIndex, mode);
  const upcoming = getOutbreak(regionCode)[upcomingSeasonForMonth(monthMeta(monthIndex).month)];
  const upcomingSeasonName = upcomingSeasonForMonth(monthMeta(monthIndex).month);
  const meta = RISK_META;

  const cells = a.forecastWindow.slice(0, 12).map((p) => {
    const val = metricValue(p.cases, region, mode);
    const risk = classify(val, a.thresholds);
    return { p, risk, val };
  });

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex w-full items-end gap-1 overflow-x-auto py-1">
        {cells.map((c, i) => (
          <Tooltip key={c.p.index}>
            <TooltipTrigger asChild>
              <div
                className="flex h-8 min-w-5 flex-1 flex-col items-center justify-center rounded-md border text-[9px] font-semibold transition-transform hover:-translate-y-0.5"
                style={{
                  backgroundColor: meta[c.risk].solidColor,
                  borderColor: `color-mix(in oklab, ${meta[c.risk].color} 60%, transparent)`,
                  color: "oklch(0.99 0.003 95)",
                  boxShadow: i === 0 ? "0 0 0 1px color-mix(in oklab, var(--card) 40%, transparent)" : undefined,
                }}
              >
                <span className="font-mono tabular-nums">
                  {Math.round(c.val).toLocaleString()}
                </span>
                <span className="opacity-80">{c.p.month.toString().padStart(2, "0")}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{formatMonthYear(c.p.label)}</p>
              <p className="mt-0.5">
                Risk: <span className="capitalize">{c.risk}</span>
              </p>
              <p className="text-primary-foreground/80">
                Forecast: {Math.round(c.val).toLocaleString()} cases
              </p>
              {i === 0 && upcoming && (
                <p className="mt-0.5 capitalize text-primary-foreground/70">
                  {upcoming.outbreak
                    ? `${upcomingSeasonName} season: outbreak signal (${OUTBREAK_TRIGGER_LABEL[upcoming.trigger] ?? upcoming.trigger})`
                    : `${upcomingSeasonName} season: no outbreak signal`}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}