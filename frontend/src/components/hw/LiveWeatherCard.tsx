import { illnessDisplayName } from "@/lib/illnessGroups";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  ExternalLink,
  Info,
  RefreshCw,
  Table as TableIcon,
  Thermometer,
  Waves,
  Wind,
  Calculator,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudienceMode } from "@/hooks/useAudienceMode";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

// Per-illness advisory entry — keyed by exact SUPPORTED_DISEASES name
interface IllnessAdvisory {
  alert_level: string;
  multiplier: number;
  guidance: string;
}

export interface PagasaTableRow {
  place: string;
  condition: string;
  caused_by: string;
  impacts: string;
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
  data_status?: string;
  primary_forecasts_modified?: boolean;
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
  raw_table?: PagasaTableRow[];
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
  UNAVAILABLE: "var(--muted-foreground)",
  HIGH: "var(--risk-high)",
  ELEVATED: "var(--risk-moderate)",
  MODERATE: "var(--risk-moderate)",
  NORMAL: "var(--risk-low)",
};

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
  className,
}: {
  regionCode: string;
  illness?: string;
  className?: string;
}) {
  const { mode: audienceMode } = useAudienceMode();
  const [data, setData] = useState<LiveWeatherResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [showActions, setShowActions] = useState(false);
  const [showSynopsis, setShowSynopsis] = useState(false);
  const [showPagasaTable, setShowPagasaTable] = useState(false);
  const [showModelBasis, setShowModelBasis] = useState(false);
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
      <div data-text-card className={cn("rounded-xl border border-border/60 bg-secondary/20 p-4 animate-pulse", className)}>
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
  if (data.data_status === "unavailable") return (
    <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
      PAGASA weather is unavailable for this region. The main forecast remains unchanged.
    </div>
  );

  const isFlood = data.flood_warning;
  const tier = data.risk_tier;
  const tierColor = TIER_COLORS[tier] ?? TIER_COLORS["NORMAL"];
  const temp = data.extremes?.temperature;
  const rh = data.extremes?.relative_humidity;
  const timeline = data.transmission_timeline;
  const actions = data.recommended_actions ?? [];
  const ctx = data.national_context;
  const rawTable = data.raw_table ?? [];

  // Illness-specific advisory keyed by exact SUPPORTED_DISEASES name
  const illnessAdvisory: IllnessAdvisory | undefined = data.disease_advisories[illness];
  const alertLevel = illnessAdvisory?.alert_level ?? tier;
  const alertColor = ALERT_COLORS[alertLevel] ?? ALERT_COLORS["BASELINE"];

  return (
    <div
      data-text-card data-explain="live-weather"
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
              PAGASA WEATHER ADVISORY
            </span>
            <p className="text-[10px] text-muted-foreground">Bulletin advisory only; it does not change forecasts, hotspot tiers or outbreak flags.</p>
            <span className="text-[11px] text-muted-foreground">
              {illnessDisplayName(illness)} · {data.region_short ?? data.region_name}
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
            title="Refresh PAGASA bulletin"
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
        {/* ── Bulletin Timestamp & Station Info ─────────────── */}
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

        {/* ── Ground Truth PAGASA Conditions ─────────────────── */}
        <div className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="label-caps text-[10px] text-muted-foreground block mb-0.5">
                PAGASA REGIONAL FORECAST ({data.place_covered})
              </span>
              <p className="text-sm font-semibold text-foreground leading-snug">{data.condition}</p>
            </div>
            {isFlood && (
              <span className="inline-flex items-center gap-1 rounded bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold shrink-0">
                <ShieldAlert className="size-3" /> Flood Hazard
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Weather System:{" "}
            <span className="font-semibold text-foreground/90">{data.caused_by}</span>
          </p>

          {data.impacts && (
            <p className="text-xs text-foreground/80 leading-relaxed italic border-t border-border/40 pt-1.5 mt-1.5">
              ⚠️ <strong>Impacts:</strong> {data.impacts}
            </p>
          )}
        </div>

        {/* ── Temperature & Humidity Extremes (Healthcare Worker Mode only) ── */}
        {audienceMode === "clinical" && (temp || rh) && (
          <div className="grid grid-cols-2 gap-2">
            {temp && (
              <div className="rounded-lg border border-border/50 bg-card/60 p-2.5 flex items-center gap-2">
                <Thermometer className="size-3.5 text-primary shrink-0" />
                <div>
                  <span className="label-caps text-[10px] text-muted-foreground block">Recorded Temp</span>
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
                  <span className="label-caps text-[10px] text-muted-foreground block">Relative Humidity</span>
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

        {/* ── Synoptic Synopsis (collapsible, Healthcare Worker Mode only) ── */}
        {audienceMode === "clinical" && ctx?.synopsis && (
          <div>
            <button
              type="button"
              onClick={() => setShowSynopsis((p) => !p)}
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <Info className="size-3 text-primary" />
                National Synoptic Synopsis
              </span>
              {showSynopsis ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            {showSynopsis && (
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-2.5 bg-card/40 p-2 rounded-r-lg">
                {ctx.synopsis}
              </p>
            )}
          </div>
        )}

        {/* ── RAW PAGASA DAILY FORECAST TABLE (Collapsible, Healthcare Worker Mode only) ──── */}
        {audienceMode === "clinical" && rawTable.length > 0 && (
          <div className="border-t border-border/50 pt-2.5">
            <button
              type="button"
              onClick={() => setShowPagasaTable((p) => !p)}
              className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <TableIcon className="size-3.5 text-primary" />
                Official PAGASA Forecast Table ({rawTable.length} areas)
              </span>
              {showPagasaTable ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showPagasaTable && (
              <div className="mt-2 space-y-2 overflow-hidden rounded-lg border border-border/70 bg-card/80 p-2">
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Ground-truth 24-hour weather forecast condition table parsed directly from the official PAGASA Daily Synoptic Weather Bulletin:
                </p>
                <div className="max-h-60 overflow-y-auto hw-scroll text-[11px] divide-y divide-border/50">
                  {rawTable.map((row, idx) => {
                    const isCurrent =
                      data.place_covered &&
                      row.place.toLowerCase().includes(data.place_covered.toLowerCase().slice(0, 8));
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "py-2 px-1.5 space-y-1 transition-colors",
                          isCurrent ? "bg-primary/10 rounded-md font-medium" : "",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="font-semibold text-foreground">
                            {row.place}
                          </span>
                          {isCurrent && (
                            <span className="rounded bg-primary/20 text-primary text-[9px] font-mono px-1 py-0.2">
                              ACTIVE REGION
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                          <div>
                            <span className="text-foreground/70 font-medium">Condition:</span>{" "}
                            {row.condition}
                          </div>
                          <div>
                            <span className="text-foreground/70 font-medium">Caused by:</span>{" "}
                            <span className="text-foreground/90 font-semibold">{row.caused_by}</span>
                          </div>
                        </div>
                        {row.impacts && (
                          <div className="text-[10px] text-foreground/75 italic">
                            ⚠️ {row.impacts}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PREDICTION MODEL BASIS TRANSPARENCY PANEL (Healthcare Worker Mode only) ──────── */}
        {audienceMode === "clinical" && (
          <div data-explain="prediction-model" className="border-t border-border/50 pt-2.5">
            <button
              type="button"
              onClick={() => setShowModelBasis((p) => !p)}
              className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Calculator className="size-3.5 text-primary" />
                Forecast model &amp; advisory basis
              </span>
              {showModelBasis ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showModelBasis && (
              <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                <p><strong>1. STATISTICAL FORECAST (SARIMAX)</strong><br />
                  y(t) = c + beta wet(t) + u(t), with autoregressive structure at lag 1 and seasonal lag 12.
                  The 80% model interval is not empirically calibrated.</p>
                <p><strong>2. WEATHER ADVISORY (PAGASA BULLETIN)</strong><br />
                  Bulletin rain and flood conditions provide context for health officers.
                  They are not measured weather regressors in the illness forecast.</p>
                <p><strong>3. SEPARATION OF FORECAST AND ADVISORY</strong><br />
                  Forecast values come only from reported history and the calendar wet/dry indicator.
                  The PAGASA advisory does not change forecast values, hotspot tiers or outbreak flags.</p>
              </div>
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
                {illnessDisplayName(illness)} · Meteorological Risk Tier
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

          </div>
        )}



        {/* ── Transmission Timeline (Healthcare Worker Mode only) ── */}
        {audienceMode === "clinical" && timeline && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <p className="label-caps text-[10px] text-muted-foreground tracking-wider font-bold">
              TYPICAL TRANSMISSION CONTEXT
            </p>
            <div className="rounded-lg bg-card/60 border border-border/50 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <Waves className="size-3 text-primary shrink-0" />
                <span className="text-[11px] font-bold text-foreground">
                  Immediate Run-off (Days 1–3)
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-4">
                {timeline.immediate_days_1_3.replace(/expected/gi, "typically associated")}
              </p>
            </div>
            <div className="rounded-lg bg-card/60 border border-border/50 p-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <Wind className="size-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-bold text-foreground">
                  Vector Proliferation Window (Weeks 2–4)
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-4">
                {timeline.short_term_weeks_2_4.replace(/expected/gi, "typically associated")}
              </p>
            </div>
          </div>
        )}

        {/* ── Recommended Actions ─────────────── */}
        {actions.length > 0 && (
          <div className="border-t border-border/50 pt-2.5">
            {audienceMode === "clinical" ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowActions((p) => !p)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    Clinical &amp; Surveillance Directives ({actions.length})
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
              </>
            ) : (
              <div className="space-y-1.5">
                <span className="label-caps text-[10px] text-muted-foreground font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary" /> Community Weather Safety Steps
                </span>
                <ul className="space-y-1 text-xs pl-1">
                  {actions.slice(0, 3).map((act, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="font-bold text-primary shrink-0 mt-0.5">•</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
