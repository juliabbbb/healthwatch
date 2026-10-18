import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, CloudRain, Siren, TrendingUp, TriangleAlert, Waves } from "lucide-react";
import type { AlertItem } from "@/lib/healthwatch/alerts";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "@/utils/formatDate";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

interface LiveWeatherSummary {
  national: {
    issued_at: string;
    synopsis: string;
    tropical_cyclone: string | null;
    active_flood_warnings_regions_count: number;
  };
  regions: Record<string, {
    region_code: string;
    region_name: string;
    region_short: string;
    condition: string;
    caused_by: string;
    impacts: string;
    flood_warning: boolean;
    risk_tier: string;
    multiplier: number;
  }>;
}

let weatherCache: LiveWeatherSummary | null = null;

/**
 * Stacked alert list featuring both historical/seasonal model alerts
 * and live PAGASA flash flood / heavy rainfall warnings.
 */
export function AlertsPanel({
  alerts,
  onFocusRegion,
  className,
}: {
  alerts: AlertItem[];
  onFocusRegion: (code: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [weather, setWeather] = useState<LiveWeatherSummary | null>(weatherCache);

  useEffect(() => {
    if (weatherCache) {
      setWeather(weatherCache);
      return;
    }
    const controller = new AbortController();
    fetch(`${API_BASE}/weather/live`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LiveWeatherSummary | null) => {
        if (data) {
          weatherCache = data;
          setWeather(data);
        }
      })
      .catch(() => {
        /* silent network fallback */
      });
    return () => controller.abort();
  }, []);

  const severeCount = alerts.filter((a) => a.kind !== "crossing").length;
  const floodCount = weather?.national?.active_flood_warnings_regions_count ?? 0;
  const hasSevere = severeCount > 0 || floodCount > 0;

  // Filter regions with active flood warnings
  const floodRegions = weather?.regions
    ? Object.values(weather.regions).filter((r) => r.flood_warning)
    : [];

  return (
    <div
      className={cn(
        "glass-panel pointer-events-auto w-full rounded-xl shadow-xl overflow-hidden border border-border/80",
        className,
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Collapse alerts panel" : "Expand alerts panel"}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <TriangleAlert
          className="size-4 shrink-0"
          style={{ color: hasSevere ? "var(--risk-high)" : "var(--muted-foreground)" }}
        />
        <span className="label-caps flex-1 text-xs font-bold text-foreground">
          Surveillance & Weather Alerts
        </span>

        {/* Live Weather Warning Badge */}
        {floodCount > 0 && (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-xs font-bold tabular-nums inline-flex items-center gap-1"
            style={{
              color: "var(--risk-high)",
              backgroundColor: "color-mix(in oklab, var(--risk-high), transparent 86%)",
            }}
            title={`${floodCount} regions under active PAGASA flood warning`}
          >
            <CloudRain className="size-3" />
            {floodCount} Weather
          </span>
        )}

        {/* Disease Alerts Count */}
        {alerts.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-xs font-bold tabular-nums"
            style={{
              color: severeCount > 0 ? "var(--risk-high)" : "var(--risk-moderate)",
              backgroundColor: `color-mix(in oklab, ${severeCount > 0 ? "var(--risk-high)" : "var(--risk-moderate)"}, transparent 86%)`,
            }}
            title={`${alerts.length} active disease alerts`}
          >
            {alerts.length > 99 ? "99+" : alerts.length} Hotspots
          </span>
        )}

        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/70 divide-y divide-border/60">
          {/* Section 1: Live PAGASA Flood Threats */}
          {floodRegions.length > 0 && (
            <div className="bg-secondary/20 p-2">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-foreground">
                <Waves className="size-3.5 text-primary" />
                <span>PAGASA Flood Hazards · Active Now</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                {floodRegions.map((fr) => (
                  <button
                    key={fr.region_code}
                    onClick={() => onFocusRegion(fr.region_code)}
                    className="flex flex-col text-left px-2.5 py-1.5 rounded-lg bg-card/70 border border-border/60 hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{fr.region_short}</span>
                      <span
                        className="font-mono text-[11px] font-bold"
                        style={{ color: "var(--risk-high)" }}
                      >
                        +{Math.round((fr.multiplier - 1) * 100)}% Surge
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">{fr.caused_by}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Model Hotspots & Outbreak Indicators */}
          <ul className="hw-scroll max-h-[34vh] sm:max-h-60 divide-y divide-border/60 overflow-y-auto">
            {alerts.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                No active disease alerts — all regions are within baseline ranges.
              </li>
            )}
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => onFocusRegion(a.regionCode)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/70 active:bg-secondary"
                >
                  <span
                    className="mt-0.5 shrink-0 rounded-md p-1.5"
                    style={{
                      color: a.kind === "outbreak" ? "var(--risk-moderate)" : "var(--risk-high)",
                      backgroundColor: `color-mix(in oklab, ${
                        a.kind === "outbreak" ? "var(--risk-moderate)" : "var(--risk-high)"
                      }, transparent 86%)`,
                    }}
                    aria-hidden="true"
                  >
                    {a.kind === "outbreak" ? (
                      <TriangleAlert className="size-3.5" />
                    ) : a.kind === "high-now" ? (
                      <Siren className="size-3.5" />
                    ) : (
                      <TrendingUp className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        a.kind === "outbreak"
                          ? "block text-xs font-semibold text-foreground"
                          : "block truncate text-xs font-medium"
                      }
                    >
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground line-clamp-2">
                      {a.detail}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                    {formatMonthYear(a.month)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="px-4 py-2 bg-secondary/15">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Click any alert or weather hazard above to instantly focus on that region.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
