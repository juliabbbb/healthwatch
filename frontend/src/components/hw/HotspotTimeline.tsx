import { PRIMARY_AGGREGATE_DISEASES, RISK_META, assessRegion, forecastPoints, metricValue, REGION_BY_CODE, type MetricMode } from "@/lib/healthwatch/data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMonthYear } from "@/utils/formatDate";

/** Each saved month uses its own regional/calendar-month thresholds. */
export function HotspotTimeline({ regionCode, illness, mode = "percapita" }: {
  regionCode: string; illness: string; mode?: MetricMode;
}) {
  const region = REGION_BY_CODE[regionCode];
  if (!region) return null;
  const diseases = illness === "all" ? PRIMARY_AGGREGATE_DISEASES : [illness];
  return (
    <TooltipProvider delayDuration={120}>
      {illness === "all" && <p className="mb-3 text-xs text-muted-foreground">Risk is classified separately for each contributing disease; there is no combined risk tier.</p>}
      {diseases.map((disease) => {
        const points = forecastPoints(regionCode, disease);
        return <div key={disease} className="mb-3">
          <p className="mb-1 text-xs text-muted-foreground">{disease}{points.length ? ` · ${formatMonthYear(points[0]!.label)} – ${formatMonthYear(points.at(-1)!.label)}` : " · No eligible forecast"}</p>
          <div className="flex w-full items-end gap-1 overflow-x-auto py-1">
            {points.map((point) => {
              const assessment = assessRegion(regionCode, disease, point.index, mode);
              const meta = RISK_META[assessment.risk];
              const value = metricValue(point.cases, region, mode);
              const unit = mode === "raw" ? "cases" : "per 100,000";
              return <Tooltip key={point.label}>
                <TooltipTrigger asChild>
                  <button type="button" aria-label={`${formatMonthYear(point.label)}: ${meta.label}, ${value.toFixed(1)} ${unit}`} className="flex h-10 min-w-9 flex-1 flex-col items-center justify-center rounded-md border text-[9px] font-semibold" style={{ backgroundColor: meta.solidColor, borderColor: meta.color, color: "var(--card)" }}>
                    <span className="font-mono tabular-nums">{value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                    <span>{point.month.toString().padStart(2, "0")}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{formatMonthYear(point.label)} · {meta.label}</p>
                  <p>Forecast: {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}</p>
                  <p>{assessment.risk === "unavailable" ? "Insufficient regional history for this month's thresholds." : "Compared with this region's same-calendar-month P50/P75."}</p>
                </TooltipContent>
              </Tooltip>;
            })}
          </div>
        </div>;
      })}
    </TooltipProvider>
  );
}
