import { TriangleAlert } from "lucide-react";
import {
  OUTBREAK_TRIGGER_LABEL,
  type OutbreakIndicator,
  type Season,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export interface OutbreakBannerProps {
  regionName: string;
  season: Season;
  indicator?: OutbreakIndicator | undefined;
  className?: string;
}

/**
 * Conditional alert strip shown only when the region's upcoming-season probe
 * is flagged as an outbreak. Names the triggering rule in plain language.
 */
export function OutbreakBanner({
  regionName,
  season,
  indicator,
  className,
}: OutbreakBannerProps) {
  if (!indicator || !indicator.outbreak) return null;

  const trigger = OUTBREAK_TRIGGER_LABEL[indicator.trigger] ?? indicator.trigger;
  const detail =
    indicator.trigger === "consecutive_high" || indicator.trigger === "both"
      ? ` — ${indicator.consecutive_high_n} consecutive monthly High forecasts`
      : "";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-snug",
        className,
      )}
      style={{
        color: "var(--risk-high-solid)",
        borderColor: "color-mix(in oklab, var(--risk-high) 40%, transparent)",
        backgroundColor: "color-mix(in oklab, var(--risk-high) 12%, transparent)",
      }}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">Outbreak signal — {season} season.</span>{" "}
        {regionName}: {trigger}
        {detail}.
      </p>
    </div>
  );
}