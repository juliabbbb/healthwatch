import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  ExternalLink,
  Info,
  RefreshCw,
  Thermometer,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

// Per-illness advisory entry — keyed by exact SUPPORTED_DISEASES name
interface IllnessAdvisory {
  alert_level: string;
  multiplier: number;
  guidance: string;
}

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
  // Keyed by exact disease name matching SUPPORTED_DISEASES
  disease_advisories: Record<string, IllnessAdvisory>;
  extremes?: {
    temperature?: { max: string; min: string };
    relative_humidity?: { max: string; min: string };
  };
  national_context?: {
    issued_at: string;
    synopsis: string;
    tropical_cyclone: string | null;
    source: string;
    source_url: string;
  };
}

const ALERT_COLORS: Record<string, string> = {
  HIGH: "var(--risk-high)",
  ELEVATED: "var(--risk-moderate)",
  MODERATE: "var(--risk-moderate)",
  LOW: "var(--risk-low)",
  BASELINE: "var(--risk-low)",
  NORMAL: "var(--risk-low)",
};

const TIER_COLORS: Record<string, string> = {
  HIGH: "var(--risk-high)",
  ELEVATED: "var(--risk-moderate)",
  MODERATE: "var(--risk-moderate)",
  NORMAL: "var(--risk-low)",
};

// Snapshot of the next Prophet forecast point, passed in from ForecastCard
export interface NextForecastSnapshot {
  value: number;   // metric value (raw or per-100k depending on mode)
  lower: number;   // 95% CI lower bound
  upper: number;   // 95% CI upper bound
  label: string;   // e.g. "2026-11"
  unit: string;    // e.g. "cases" or "per 100k"
  mode: string;    // "raw" | "percapita"
}

// Cache keyed by regionCode — cleared on manual refresh
const weatherCache = new Map<string, { data: LiveWeatherResponse; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour matches backend

async function fetchLiveWeather(
  regionCode: string,
  signal?: AbortSignal,
): Promise<LiveWeatherResponse> {
  const res = await fetch(
    `${API_BASE}/weather/live/${encodeURIComponent(regionCode)}`,
    { signal: signal ?? null },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LiveWeatherResponse;
}

function formatFetchTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

export function LiveWeatherCard({
  regionCode,
  illness = "Dengue",
  nextForecast,
  className,
}: {
  regionCode: string;
  illness?: string;
  nextForecast?: NextForecastSnapshot;
  className?: string;
}) {
  const [data, setData] = useState<LiveWeatherResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [showActions, setShowActions] = useState(false);
  const [showSynopsis, setShowSynopsis] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal, force = false) => {
      const cached = weatherCache.get(regionCode);
      if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        setData(cached.data);
        setFetchedAt(cached.fetchedAt);
        setStatus("done");
        return;
      }
      setStatus("loading");
      try {
        const res = await fetchLiveWeather(regionCode, signal);
        const now = Date.now();
        weatherCache.set(regionCode, { data: res, fetchedAt: now });
        setData(res);
        setFetchedAt(now);
        setStatus("done");
      } catch {
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

  // Live clock — re-renders every second so "Fetched at" ticks in real time
  const [, setTick] = useState(0);
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (status === "error" || (!data && status !== "loading")) return null;

  // Loading skeleton
  if (status === "loading" && !data) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-secondary/20 p-4 animate-pulse", className)}>
        <div className="flex items-center gap-2 mb-3">
          <CloudRain className="size-4 text-primary opacity-50" />
          <div className="h-3 w-36 rounded bg-secondary/60" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-secondary/40" />
          <div className="h-3 w-3/4 rounded bg-secondary/40" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isFlood = data.flood_warning;
  const tier = data.risk_tier;
  const tierColor = TIER_COLORS[tier] ?? TIER_COLORS.NORMAL;
  const temp = data.extremes?.temperature;
  const rh = data.extremes?.relative_humidity;
  const timeline = data.transmission_timeline;
  const actions = data.recommended_actions ?? [];
  const ctx = data.national_context;

  // Illness-specific advisory keyed by exact SUPPORTED_DISEASES name
  const illnessAdvisory: IllnessAdvisory | undefined = data.disease_advisories[illness];
  const alertLevel = illnessAdvisory?.alert_level ?? tier;
  const alertColor = ALERT_COLORS[alertLevel] ?? ALERT_COLORS.BASELINE;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 overflow-hidden transition-all shadow-xs text-left",
        isFlood ? "border-l-4" : "",
        className,
      )}
      style={{ borderLeftColor: isFlood ? "var(--risk-high)" : undefined }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60 bg-secondary/20">
        <div className="flex items-center gap-2">
          <CloudRain className="size-4 text-primary shrink-0" />
          <div>
            <span className="label-caps text-xs text-foreground font-bold tracking-wider block">
              PAGASA WEATHER NOWCAST
            </span>
            <span className="text-[11px] text-muted-foreground">
              {illness} · {data.region_short ?? data.region_name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Overall risk tier badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-semibold"
            style={{
              color: tierColor,
              backgroundColor: `color-mix(in oklab, ${tierColor}, transparent 87%)`,
            }}
          >
            <span
              className="size-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: tierColor }}
            />
            {tier}
          </span>

          {/* Manual refresh */}
          <button
            type="button"
            title="Refresh bulletin"
            onClick={() => {
              weatherCache.delete(regionCode);
              const ctrl = new AbortController();
              load(ctrl.signal, true);
            }}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <RefreshCw className={cn("size-3", status === "loading" && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 bg-secondary/10">
        {/* ── Bulletin Timestamp (live ticking clock) ────────── */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Bulletin:{" "}
            <span className="font-semibold text-foreground/80">
              {ctx?.issued_at ?? "Latest Daily Forecast"}
            </span>
          </span>
          {fetchedAt && (
            <span>
              Fetched{" "}
              <span className="font-mono tabular-nums text-foreground/70">
                {formatFetchTime(fetchedAt)}
              </span>
            </span>
          )}
        </div>

        {/* ── Ground Truth Conditions ─────────────────────────── */}
        <div className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-1.5">
          <p className="text-sm font-semibold text-foreground leading-snug">{data.condition}</p>
          <p className="text-xs text-muted-foreground">
            Weather System:{" "}
            <span className="font-medium text-foreground/80">{data.caused_by}</span>
          </p>
          {data.impacts && (
            <p className="text-xs text-foreground/75 leading-relaxed italic border-t border-border/40 pt-1.5 mt-1.5">
              ⚠️ {data.impacts}
            </p>
          )}
        </div>

        {/* ── Temperature & Humidity Extremes ────────────────── */}
        {(temp || rh) && (
          <div className="grid grid-cols-2 gap-2">
            {temp && (
              <div className="rounded-lg border border-border/50 bg-card/60 p-2.5 flex items-center gap-2">
                <Thermometer className="size-3.5 text-primary shrink-0" />
                <div>
                  <span className="label-caps text-[10px] text-muted-foreground block">Temp</span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {temp.min} – {temp.max}
                  </span>
                </div>
              </div>
            )}
            {rh && (
              <div className="rounded-lg border border-border/50 bg-card/60 p-2.5 flex items-center gap-2">
                <Waves className="size-3.5 text-primary shrink-0" />
                <div>
                  <span className="label-caps text-[10px] text-muted-foreground block">Humidity</span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {rh.min} – {rh.max}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Active Tropical Cyclone banner ─────────────────── */}
        {ctx?.tropical_cyclone && (
          <div
            className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
            style={{
              borderColor: "color-mix(in oklab, var(--risk-high), transparent 55%)",
              background: "color-mix(in oklab, var(--risk-high), transparent 91%)",
              color: "var(--risk-high)",
            }}
          >
            <span className="font-bold">🌀 Active Tropical System: </span>
            {ctx.tropical_cyclone}
          </div>
        )}

        {/* ── Synoptic Synopsis (collapsible) ────────────────── */}
        {ctx?.synopsis && (
          <div>
            <button
              type="button"
              onClick={() => setShowSynopsis((p) => !p)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <Info className="size-3" />
                Synoptic Synopsis
              </span>
              {showSynopsis ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            {showSynopsis && (
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed border-l-2 border-border/60 pl-2.5">
                {ctx.synopsis}
              </p>
            )}
          </div>
        )}

        {/* ── Illness-Specific Advisory ──────────────────────── */}
        {illnessAdvisory && (
          <div
            className="rounded-lg border p-3 space-y-1.5"
            style={{
              borderColor: `color-mix(in oklab, ${alertColor}, transparent 58%)`,
              background: `color-mix(in oklab, ${alertColor}, transparent 91%)`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="label-caps text-[11px] font-bold tracking-wider"
                style={{ color: alertColor }}
              >
                {illness} · Weather Risk
              </span>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold"
                style={{
                  color: alertColor,
                  background: `color-mix(in oklab, ${alertColor}, transparent 78%)`,
                }}
              >
                {alertLevel}
              </span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {illnessAdvisory.guidance}
            </p>
            {illnessAdvisory.multiplier > 1.01 && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <Zap className="size-3 shrink-0" style={{ color: alertColor }} />
                <span className="text-[11px] font-mono font-semibold" style={{ color: alertColor }}>
                  +{((illnessAdvisory.multiplier - 1) * 100).toFixed(0)}% weather surge modifier
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Weather-Adjusted Forecast Impact ─────────────────── */}
        {illnessAdvisory && nextForecast && illnessAdvisory.multiplier > 1.01 && (() => {
          const m = illnessAdvisory.multiplier;
          const isRaw = nextForecast.mode === "raw";
          const adjValue  = isRaw ? Math.round(nextForecast.value * m)  : Math.round(nextForecast.value * m * 10) / 10;
          const adjLower  = isRaw ? Math.round(nextForecast.lower * m)  : Math.round(nextForecast.lower * m * 10) / 10;
          const adjUpper  = isRaw ? Math.round(nextForecast.upper * m)  : Math.round(nextForecast.upper * m * 10) / 10;
          const baseStr   = isRaw ? nextForecast.value.toLocaleString() : nextForecast.value.toLocaleString(undefined, { maximumFractionDigits: 1 });
          const adjStr    = isRaw ? adjValue.toLocaleString()            : adjValue.toLocaleString(undefined, { maximumFractionDigits: 1 });
          const adjLoStr  = isRaw ? adjLower.toLocaleString()            : adjLower.toLocaleString(undefined, { maximumFractionDigits: 1 });
          const adjHiStr  = isRaw ? adjUpper.toLocaleString()            : adjUpper.toLocaleString(undefined, { maximumFractionDigits: 1 });
          const monthLabel = nextForecast.label
            ? new Date(nextForecast.label + "-01").toLocaleDateString("en-PH", { month: "long", year: "numeric" })
            : "Next month";
          return (
            <div className="rounded-lg border border-border/60 bg-card/70 p-3 space-y-2">
              <p className="label-caps text-[10px] text-muted-foreground tracking-wider font-bold">
                WEATHER-ADJUSTED FORECAST · {monthLabel.toUpperCase()}
              </p>
              {/* Baseline → Adjusted comparison row */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex flex-col items-center rounded-md bg-secondary/50 border border-border/50 px-2.5 py-1.5 min-w-0">
                  <span className="label-caps text-[9px] text-muted-foreground">Prophet Baseline</span>
                  <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                    {baseStr}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{nextForecast.unit}</span>
                </div>

                <div className="flex flex-col items-center gap-0.5">
                  <ArrowRight className="size-4" style={{ color: alertColor }} />
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{ color: alertColor }}
                  >
                    ×{m.toFixed(2)}
                  </span>
                </div>

                <div
                  className="flex flex-col items-center rounded-md border px-2.5 py-1.5 min-w-0"
                  style={{
                    borderColor: `color-mix(in oklab, ${alertColor}, transparent 55%)`,
                    background: `color-mix(in oklab, ${alertColor}, transparent 88%)`,
                  }}
                >
                  <span className="label-caps text-[9px]" style={{ color: alertColor }}>Weather-Adjusted</span>
                  <span className="font-mono text-sm font-bold tabular-nums" style={{ color: alertColor }}>
                    {adjStr}
                  </span>
                  <span className="text-[10px]" style={{ color: alertColor }}>{nextForecast.unit}</span>
                </div>
              </div>

              {/* Adjusted CI */}
              <p className="text-[11px] text-muted-foreground">
                Adjusted 95% CI:{" "}
                <span className="font-mono tabular-nums text-foreground/75">{adjLoStr} – {adjHiStr}</span>
                {" "}{nextForecast.unit}
              </p>

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed border-t border-border/40 pt-1.5">
                ⚠️ This is an operational nowcast adjustment applied to the Prophet model output.
                It reflects current weather conditions only — not a re-run of the forecasting model.
              </p>
            </div>
          );
        })()}

        {/* ── Transmission Timeline ──────────────────────────── */}
        {timeline && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <p className="label-caps text-[10px] text-muted-foreground tracking-wider font-bold">
              WHAT TO EXPECT
            </p>
            <div className="rounded-lg bg-card/60 border border-border/50 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <Waves className="size-3 text-primary shrink-0" />
                <span className="text-[11px] font-bold text-foreground">Days 1–3</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-4">
                {timeline.immediate_days_1_3}
              </p>
            </div>
            <div className="rounded-lg bg-card/60 border border-border/50 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <Wind className="size-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-bold text-foreground">Weeks 2–4</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-4">
                {timeline.short_term_weeks_2_4}
              </p>
            </div>
          </div>
        )}

        {/* ── Recommended Actions (collapsible) ─────────────── */}
        {actions.length > 0 && (
          <div className="border-t border-border/50 pt-2.5">
            <button
              type="button"
              onClick={() => setShowActions((p) => !p)}
              className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors py-1"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" />
                Recommended Actions ({actions.length})
              </span>
              {showActions ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            {showActions && (
              <ul className="mt-2 space-y-1.5 pl-1 text-xs text-muted-foreground leading-relaxed">
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

        {/* ── Footer — source label + PAGASA link ───────────── */}
        <div className="border-t border-border/40 pt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{ctx?.source ?? "PAGASA Daily Weather Forecast"}</span>
          <a
            href="https://pagasa.dost.gov.ph/weather#daily-weather-forecast"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition-colors"
          >
            Official PAGASA <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
