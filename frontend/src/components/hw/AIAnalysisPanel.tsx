import { useCallback, useEffect, useState } from "react";
import { Bot, ChevronDown, TriangleAlert } from "lucide-react";
import { REGION_BY_CODE } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

/**
 * Opt-in AI-assisted analysis. Calls /analysis/{region} which narrates
 * already-computed pipeline outputs via Claude. This component never renders
 * unless the user enabled the feature in Settings — when it is off it is not
 * mounted and makes zero network requests.
 *
 * Responses are cached per region+disease+window (module-level, same style as
 * seriesCache/metricsCache) so re-viewing a region does not re-call the LLM;
 * "Regenerate" explicitly bypasses the cache. Chip changes on the region page
 * (horizon/illness/season) intentionally do NOT trigger a refetch.
 */

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";
const DISEASE = "Dengue";
const WINDOW = "pre_covid_52w";

interface GroundingData {
  observed_through: { week_label: string; cases: number };
  forecast: { target_date: string; yhat: number; yhat_lower: number; yhat_upper: number };
  classification: { date: string; yhat: number; p50: number; p75: number; risk_level: string };
  thresholds_for_iso_week: { iso_week: number; p50: number; p75: number } | null;
  validation: {
    window: string;
    MAE: number;
    RMSE: number;
    MAPE: number;
    weeks: number;
    skill_vs_naive_pct: number | null;
  };
  confidence: { label: string; tone: string; note: string };
}

interface AnalysisResponse {
  narrative: string;
  grounding_data: GroundingData;
  model: string;
}

const analysisCache = new Map<string, AnalysisResponse>();

function cacheKey(regionShort: string): string {
  return `${regionShort}:${DISEASE}:${WINDOW}`;
}

async function requestAnalysis(
  regionShort: string,
  signal?: AbortSignal,
): Promise<AnalysisResponse> {
  const path = `/analysis/${encodeURIComponent(regionShort)}?disease=${DISEASE}&window=${WINDOW}`;
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

export function AIAnalysisPanel({ regionCode }: { regionCode: string }) {
  const region = REGION_BY_CODE[regionCode];
  const regionShort = region?.short ?? regionCode;

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<AnalysisResponse | null>(
    analysisCache.get(cacheKey(regionShort)) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [showGrounding, setShowGrounding] = useState(false);

  const load = useCallback(
    async (bypassCache: boolean, signal?: AbortSignal) => {
      const key = cacheKey(regionShort);
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
        const res = await requestAnalysis(regionShort, signal);
        analysisCache.set(key, res);
        setResult(res);
        setStatus("success");
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    },
    [regionShort],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div>
      {/* Transparency header: always mark this as generated, never as a forecast. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
          <Bot className="size-3.5" /> AI-generated summary
        </span>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={status === "loading"}
          aria-label="Regenerate AI analysis"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          Regenerate
        </button>
      </div>

      {status === "loading" && (
        <div className="mt-3 space-y-2" role="status" aria-label="Generating AI analysis">
          <div className="h-3 w-full animate-pulse rounded bg-secondary" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-4/6 animate-pulse rounded bg-secondary" />
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <p>
            AI analysis unavailable: {error}. The rest of this page is unaffected — you can retry
            with Regenerate.
          </p>
        </div>
      )}

      {status === "success" && result && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{result.narrative}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Generated by {result.model} from the pipeline numbers below — not a separate
            forecast or risk assessment.
          </p>

          <button
            type="button"
            onClick={() => setShowGrounding((v) => !v)}
            aria-expanded={showGrounding}
            className="label-caps mt-4 inline-flex items-center gap-1 hover:text-foreground"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", showGrounding && "rotate-180")}
            />
            Grounding data
          </button>
          {showGrounding && <GroundingReadout data={result.grounding_data} />}
        </>
      )}
    </div>
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

function GroundingReadout({ data }: { data: GroundingData }) {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <dl className="mt-2 grid gap-x-6 gap-y-4 rounded-lg border border-border bg-card/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <Group title="Observed">
        <Row label="Week" value={data.observed_through.week_label} />
        <Row label="Reported cases" value={data.observed_through.cases.toLocaleString()} />
      </Group>
      <Group title={`Forecast (${data.forecast.target_date})`}>
        <Row label="Predicted" value={fmt(data.forecast.yhat)} />
        <Row
          label="95% interval"
          value={`${fmt(data.forecast.yhat_lower)} – ${fmt(data.forecast.yhat_upper)}`}
        />
      </Group>
      <Group title={`Classification (${data.classification.date})`}>
        <Row label="Risk level" value={data.classification.risk_level} />
        <Row
          label="P50 / P75"
          value={`${fmt(data.classification.p50)} / ${fmt(data.classification.p75)}`}
        />
      </Group>
      <Group title={`Validation (${data.validation.window})`}>
        <Row label="MAE" value={fmt(data.validation.MAE)} />
        <Row label="RMSE" value={fmt(data.validation.RMSE)} />
        <Row label="MAPE" value={`${fmt(data.validation.MAPE)}%`} />
        <Row
          label="Skill vs naive"
          value={
            data.validation.skill_vs_naive_pct == null
              ? "—"
              : `${data.validation.skill_vs_naive_pct > 0 ? "+" : ""}${fmt(data.validation.skill_vs_naive_pct)}%`
          }
        />
        <Row label="Backtest weeks" value={String(data.validation.weeks)} />
      </Group>
      <Group title="Confidence">
        <Row label="Label" value={data.confidence.label} />
        <p className="text-[11px] leading-snug text-muted-foreground">{data.confidence.note}</p>
      </Group>
    </dl>
  );
}
