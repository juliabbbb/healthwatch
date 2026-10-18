import { useCallback, useEffect, useState } from "react";
import { CloudRain, ExternalLink, ShieldAlert, Waves } from "lucide-react";
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
  const isDengue = illness.toLowerCase().includes("dengue");
  const isLepto = illness.toLowerCase().includes("lepto");

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 p-3.5 transition-all text-left",
        isFlood
          ? "bg-secondary/40 border-l-4"
          : "bg-secondary/20",
        className,
      )}
      style={{
        borderLeftColor: isFlood ? "var(--risk-high)" : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <CloudRain className="size-3.5 text-primary" />
          <span className="label-caps text-[10px] text-foreground font-semibold tracking-wider">
            PAGASA DAILY WEATHER NOWCAST
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium"
          style={{
            color: isFlood ? "var(--risk-high)" : "var(--risk-low)",
            backgroundColor: `color-mix(in oklab, ${isFlood ? "var(--risk-high)" : "var(--risk-low)"}, transparent 88%)`,
          }}
        >
          <span
            className="size-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: isFlood ? "var(--risk-high)" : "var(--risk-low)" }}
          />
          {isFlood ? "Active Heavy Rain / Flood Threat" : "Normal Conditions"}
        </span>
      </div>

      {/* Weather Condition & Synoptic System */}
      <p className="text-xs text-foreground font-medium leading-snug">
        {data.condition}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Caused by: <span className="font-semibold text-foreground/80">{data.caused_by}</span>
      </p>

      {/* Disease-Specific Operational Advisory */}
      <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-1.5">
        {/* If viewing Dengue or general */}
        {(!isLepto) && (
          <div className="flex items-start gap-2">
            <span
              className="label-caps shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold"
              style={{
                color: isFlood ? "var(--risk-high)" : "var(--muted-foreground)",
                backgroundColor: `color-mix(in oklab, ${isFlood ? "var(--risk-high)" : "var(--muted-foreground)"}, transparent 88%)`,
              }}
            >
              Dengue
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {data.disease_advisories.dengue.guidance}
            </p>
          </div>
        )}

        {/* Leptospirosis Advisory */}
        <div className="flex items-start gap-2">
          <span
            className="label-caps shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold"
            style={{
              color: isFlood ? "var(--risk-high)" : "var(--risk-low)",
              backgroundColor: `color-mix(in oklab, ${isFlood ? "var(--risk-high)" : "var(--risk-low)"}, transparent 88%)`,
            }}
          >
            Leptospirosis
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {data.disease_advisories.leptospirosis.guidance}
          </p>
        </div>

        {/* Multiplier Impact Banner if Flood Warning */}
        {isFlood && (
          <div className="mt-2 rounded-lg bg-secondary/60 border border-border/70 p-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-destructive shrink-0" />
              <span className="text-[10px] text-foreground font-medium">
                Real-time Weather Multiplier:
              </span>
            </div>
            <span
              className="font-mono text-xs font-bold tabular-nums"
              style={{ color: "var(--risk-high)" }}
            >
              {data.multiplier}x Baseline Surge Risk
            </span>
          </div>
        )}
      </div>

      {/* Source Footer */}
      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Official Bulletin: {data.national_context?.issued_at ?? "PAGASA Synoptic"}</span>
        <a
          href="https://pagasa.dost.gov.ph/weather#daily-weather-forecast"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          PAGASA Forecast <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  );
}
