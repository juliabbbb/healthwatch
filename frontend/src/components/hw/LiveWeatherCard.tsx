import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  ExternalLink,
  ShieldAlert,
  Thermometer,
  Waves,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

interface LiveWeatherResponse {
  region_code: string;
  region_name: string;
  region_short: string;
  place_covered: string;
  condition: string;
  caused_by: string;
  impacts: string;
  flood_warning: boolean;
  risk_tier: "NORMAL" | "MODERATE" | "ELEVATED" | "HIGH";
  multiplier: number;
  transmission_timeline?: {
    immediate_days_1_3: string;
    short_term_weeks_2_4: string;
  };
  recommended_actions?: string[];
  disease_advisories: {
    leptospirosis: {
      alert_level: string;
      guidance: string;
    };
    dengue: {
      alert_level: string;
      guidance: string;
    };
    fwbd: {
      guidance: string;
    };
  };
  extremes?: {
    temperature?: {
      max: string;
      max_time?: string;
      min: string;
      min_time?: string;
    };
    relative_humidity?: {
      max: string;
      max_time?: string;
      min: string;
      min_time?: string;
    };
  };
  national_context?: {
    issued_at: string;
    synopsis: string;
    tropical_cyclone: string | null;
    source: string;
    source_url: string;
  };
}

const weatherCache = new Map<string, LiveWeatherResponse>();

async function fetchLiveWeather(regionCode: string, signal?: AbortSignal): Promise<LiveWeatherResponse> {
  const res = await fetch(`${API_BASE}/weather/live/${encodeURIComponent(regionCode)}`, {
    signal: signal ?? null,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as LiveWeatherResponse;
}

export function LiveWeatherCard({
  regionCode,
  illness = "Dengue",
  className,
}: {
  regionCode: string;
  illness?: string;
  className?: string;
}) {
  const [data, setData] = useState<LiveWeatherResponse | null>(
    weatherCache.get(regionCode) ?? null,
  );
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    weatherCache.has(regionCode) ? "done" : "idle",
  );
  const [showActions, setShowActions] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const hit = weatherCache.get(regionCode);
      if (hit) {
        setData(hit);
        setStatus("done");
        return;
      }
      setStatus("loading");
      try {
        const res = await fetchLiveWeather(regionCode, signal);
        weatherCache.set(regionCode, res);
        setData(res);
        setStatus("done");
      } catch (err) {
        if (signal?.aborted) return;
        setStatus("error");
      }
    },
    [regionCode],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (status === "error" || !data) {
    return null;
  }

  const isFlood = data.flood_warning;
  const temp = data.extremes?.temperature;
  const rh = data.extremes?.relative_humidity;
  const timeline = data.transmission_timeline;
  const actions = data.recommended_actions ?? [];

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 p-4 transition-all text-left shadow-xs",
        isFlood ? "bg-secondary/40 border-l-4" : "bg-secondary/25",
        className,
      )}
      style={{
        borderLeftColor: isFlood ? "var(--risk-high)" : undefined,
      }}
    >
      {/* 1. Card Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <CloudRain className="size-4 text-primary" />
          <div>
            <span className="label-caps text-xs text-foreground font-bold tracking-wider block">
              PAGASA WEATHER NOWCAST
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Operational Real-time Surveillance
            </span>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono font-semibold"
          style={{
            color: isFlood ? "var(--risk-high)" : "var(--risk-low)",
            backgroundColor: `color-mix(in oklab, ${isFlood ? "var(--risk-high)" : "var(--risk-low)"}, transparent 86%)`,
          }}
        >
          <span
            className="size-2 rounded-full animate-pulse"
            style={{ backgroundColor: isFlood ? "var(--risk-high)" : "var(--risk-low)" }}
          />
          {isFlood ? "Active Flood Threat" : "Normal Conditions"}
        </span>
      </div>

      {/* 2. Today's Ground Truth Conditions */}
      <div className="pt-3 space-y-1.5">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {data.condition}
        </p>
        <p className="text-xs text-muted-foreground leading-normal">
          Weather System: <span className="font-semibold text-foreground/90">{data.caused_by}</span>
        </p>
        {data.impacts && (
          <p className="text-xs text-foreground/80 leading-relaxed italic bg-secondary/40 px-2.5 py-1.5 rounded-md border border-border/50">
            ⚠️ {data.impacts}
          </p>
        )}
      </div>

      {/* 3. Observed Atmospheric Extremes (if available) */}
      {(temp || rh) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {temp && (
            <div className="rounded-lg bg-card/70 border border-border/60 p-2">
              <span className="label-caps text-[10px] text-muted-foreground block mb-0.5">
                Observed Temp
              </span>
              <span className="font-mono text-xs font-bold text-foreground">
                {temp.min} – {temp.max}
              </span>
            </div>
          )}
          {rh && (
            <div className="rounded-lg bg-card/70 border border-border/60 p-2">
              <span className="label-caps text-[10px] text-muted-foreground block mb-0.5">
                Relative Humidity
              </span>
              <span className="font-mono text-xs font-bold text-foreground">
                {rh.min} – {rh.max}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 4. "What to Expect" Transmission Timeline */}
      {timeline && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
          <p className="label-caps text-[11px] text-muted-foreground font-bold tracking-wider">
            WHAT TO EXPECT · TRANSMISSION HORIZON
          </p>

          {/* Phase 1: Days 1–3 */}
          <div className="rounded-lg bg-card/60 border border-border/60 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <Waves className="size-3.5 text-primary shrink-0" />
              <span className="text-xs font-bold text-foreground">
                Immediate Window (Days 1–3)
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-5">
              {timeline.immediate_days_1_3}
            </p>
          </div>

          {/* Phase 2: Weeks 2–4 */}
          <div className="rounded-lg bg-card/60 border border-border/60 p-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-destructive shrink-0" />
              <span className="text-xs font-bold text-foreground">
                Vector Breeding Surge (Weeks 2–4)
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-5">
              {timeline.short_term_weeks_2_4}
            </p>
          </div>
        </div>
      )}

      {/* 5. Real-Time Multiplier Banner */}
      {isFlood && (
        <div className="mt-3 rounded-lg bg-secondary/80 border border-border p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-destructive shrink-0" />
            <span className="text-xs text-foreground font-semibold">
              Nowcast Weather Multiplier:
            </span>
          </div>
          <span
            className="font-mono text-sm font-bold tabular-nums"
            style={{ color: "var(--risk-high)" }}
          >
            {data.multiplier}x Baseline Surge Risk
          </span>
        </div>
      )}

      {/* 6. Recommended Action Checklist Accordion */}
      {actions.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowActions((prev) => !prev)}
            className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors py-1"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-primary" />
              Recommended Community Actions ({actions.length})
            </span>
            {showActions ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {showActions && (
            <ul className="mt-2 space-y-1.5 pl-2 text-xs text-muted-foreground leading-relaxed">
              {actions.map((act, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-[11px] font-bold text-primary shrink-0 mt-0.5">
                    {idx + 1}.
                  </span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 7. Official Source Footer */}
      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span>Bulletin: {data.national_context?.issued_at ?? "PAGASA Synoptic"}</span>
        <a
          href="https://pagasa.dost.gov.ph/weather#daily-weather-forecast"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
        >
          Official PAGASA <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}
