import { useCallback, useEffect, useState } from "react";
import { Bot, ChevronDown, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Floating AI explanation for Seasonality-page charts. Glassmorphic modal over
 * the active view. Only mounted/opened when the user enabled AI analysis in
 * Settings — closed state makes zero network calls. Narrative comes from
 * /analysis/seasonality and always ships with the pipeline numbers it was
 * grounded in (expandable below the text).
 */

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";
const DISEASE = "Dengue";

export type SeasonalityComponent = "observed" | "trend" | "seasonal" | "residual" | "acf";

const COMPONENT_LABELS: Record<SeasonalityComponent, string> = {
  observed: "Observed series",
  trend: "Trend component",
  seasonal: "Seasonal pattern",
  residual: "Noise (residual)",
  acf: "52-week cycle indicators",
};

interface SeasonalityGrounding {
  region: string;
  disease: string;
  observed_weeks: number;
  series_start: string;
  series_end: string;
  trend: { latest_index: number; change_pct_2y: number };
  seasonal: {
    peak_week: number;
    peak_month: string;
    trough_week: number;
    trough_month: string;
    strength_pct: number;
  };
  cycle: {
    acf_lag52: number;
    acf_lag26: number;
    dominant_lag_weeks: number;
    dominant_lag_acf: number;
  };
  wet_dry: { wet_season_mean_cases: number; dry_season_mean_cases: number };
}

interface AnalysisResponse {
  narrative: string;
  grounding_data: SeasonalityGrounding;
  model: string;
}

const analysisCache = new Map<string, AnalysisResponse>();

async function requestExplanation(
  regionShort: string,
  component: SeasonalityComponent,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const path = `/analysis/seasonality?region=${encodeURIComponent(regionShort)}&disease=${DISEASE}&component=${component}`;
  const res = await fetch(`${API_BASE}${path}`, { signal: signal ?? null });
  if (!res.ok) {
    let detail = `request failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // non-JSON error body: keep the HTTP status fallback
    }
    throw new Error(detail);
  }
  return (await res.json()) as AnalysisResponse;
}

export function AIExplanationModal({
  open,
  onOpenChange,
  regionShort,
  regionName,
  component,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regionShort: string;
  regionName: string;
  component: SeasonalityComponent;
}) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGrounding, setShowGrounding] = useState(false);

  const load = useCallback(
    async (bypassCache: boolean, signal?: AbortSignal) => {
      const key = `${regionShort}:${DISEASE}:${component}`;
      if (!bypassCache) {
        const cached = analysisCache.get(key);
        if (cached) {
          setResult(cached);
          setStatus("success");
          setError(null);
          return;
        }
      }
      setStatus("loading");
      setError(null);
      try {
        const res = await requestExplanation(regionShort, component, signal);
        analysisCache.set(key, res);
        setResult(res);
        setStatus("success");
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    },
    [regionShort, component],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => controller.abort();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[600] bg-black/50 backdrop-blur-md"
        className="z-[600] glass-panel max-w-xl gap-0 rounded-xl border-border/70 p-5"
      >
        <div className="flex items-start justify-between gap-3 pr-6">
          <div>
            <DialogTitle className="flex items-center gap-2 font-display text-base">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                <Bot className="size-3" /> AI-generated
              </span>
              {COMPONENT_LABELS[component]}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              {regionName} · plain-language reading of the pipeline&apos;s own numbers
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4">
          {status === "loading" && (
            <div className="space-y-2" role="status" aria-label="Generating AI explanation">
              <div className="h-3 w-full animate-pulse rounded bg-secondary" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <p>AI explanation unavailable: {error}. Nothing else on this page was affected.</p>
            </div>
          )}

          {status === "success" && result && (
            <>
              <p className="text-sm leading-relaxed text-foreground/90">{result.narrative}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void load(true)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => setShowGrounding((v) => !v)}
                  aria-expanded={showGrounding}
                  className="label-caps inline-flex items-center gap-1 hover:text-foreground"
                >
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", showGrounding && "rotate-180")}
                  />
                  Grounding data
                </button>
                <span className="ml-auto text-[10px] text-muted-foreground">{result.model}</span>
              </div>

              {showGrounding && <GroundingReadout data={result.grounding_data} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs tabular-nums">{value}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-caps mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function GroundingReadout({ data }: { data: SeasonalityGrounding }) {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-4 rounded-lg border border-border bg-card/60 p-3 sm:grid-cols-2">
      <Group title="Series">
        <Row label="Region" value={data.region} />
        <Row label="Weeks observed" value={String(data.observed_weeks)} />
        <Row label="Coverage" value={`${data.series_start} → ${data.series_end}`} />
      </Group>
      <Group title="Trend">
        <Row label="Latest level" value={fmt(data.trend.latest_index)} />
        <Row
          label="2-year change"
          value={`${data.trend.change_pct_2y >= 0 ? "+" : ""}${data.trend.change_pct_2y}%`}
        />
      </Group>
      <Group title="Seasonal pattern">
        <Row label="Strength" value={`${data.seasonal.strength_pct}%`} />
        <Row
          label="Peak week"
          value={`W${data.seasonal.peak_week} (~${data.seasonal.peak_month})`}
        />
        <Row
          label="Trough week"
          value={`W${data.seasonal.trough_week} (~${data.seasonal.trough_month})`}
        />
      </Group>
      <Group title="Annual cycle (ACF)">
        <Row label="Lag 52" value={data.cycle.acf_lag52.toFixed(2)} />
        <Row label="Lag 26" value={data.cycle.acf_lag26.toFixed(2)} />
        <Row
          label="Dominant lag"
          value={`${data.cycle.dominant_lag_weeks}w (${data.cycle.dominant_lag_acf.toFixed(2)})`}
        />
      </Group>
      <Group title="Wet vs dry season">
        <Row label="Wet mean cases/wk" value={fmt(data.wet_dry.wet_season_mean_cases)} />
        <Row label="Dry mean cases/wk" value={fmt(data.wet_dry.dry_season_mean_cases)} />
      </Group>
    </dl>
  );
}
